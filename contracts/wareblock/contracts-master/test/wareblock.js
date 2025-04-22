const { expect } = require("chai");

const { getTxTimestamp, daysInSeconds, TOKEN_DECIMALS, DAI_ADDRESS_BY_NETWORK_NAME } = require('../helpers');

describe("Wareblock", function () {
  let daiAddress, dai
  const DEADLINE = 7961186785 // = April 2222. We don't care about ETH-DAI swap deadline during testing

  before(async function() {
    let { name } = await ethers.provider.getNetwork()
    daiAddress = DAI_ADDRESS_BY_NETWORK_NAME[name]

    dai = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", daiAddress)
  })

  it("Should set the contract owner correctly", async function () {
    const [owner] = await ethers.getSigners(); // Get first address
    const Wareblock = await ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);
    await wareblock.deployed();

    expect(await wareblock.owner()).to.equal(owner.address);
  });

  it("Should prevent non-owners from adding a warehouse", async function () {
    const [owner, notOwner] = await ethers.getSigners();
    const Wareblock = await ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);
    await wareblock.deployed();

    await expect(wareblock.connect(notOwner).addWarehouse(
      // Random parameters - We just want to test onlyOwner
      "Test",
      "MTK",
      [1000],
      "some link",
      [1],
      notOwner.address,
      30,
    )).to.be.revertedWith('You are not the owner of the Wareblock contract');
  });

  it("Should prevent adding a warehouse where the total supply is not divisible by the goal", async function () {
    const [owner] = await ethers.getSigners();
    const Wareblock = await ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);
    await wareblock.deployed();

    await expect(wareblock.connect(owner).addWarehouse(
      "Test",
      "MTK",
      [1],
      "some link",
      [3],
      owner.address,
      30,
    )).to.be.revertedWith('Total supply is not divisible by goal');
  });

  it("Should correctly initialize a new warehouse token and crowdsale", async function () {
    // Assume that:
    // - account 0 is the owner of the Wareblock contract and
    // - account 1 is the account that will receive the crowdsale income
    const [wareblockOwner, crowdsaleBeneficiary, investor] = await ethers.getSigners(); // Get first address
    const NAME = "Regie"
    const SYMBOL = "WB0"
    const TOTAL_SUPPLY = ethers.BigNumber.from(10).pow(TOKEN_DECIMALS).mul(10000)
    const TOKEN_URI = "https://wareblock.com/properties/regie" // Example
    const GOAL = ethers.constants.WeiPerEther.mul(1000)
    const CROWDSALE_DURATION = daysInSeconds(90) // closes 90 days later

    const Wareblock = await ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);
    await wareblock.deployed();

    const tx = await wareblock.addWarehouse(
      NAME,
      SYMBOL,
      [TOTAL_SUPPLY],
      TOKEN_URI,
      [GOAL],
      crowdsaleBeneficiary.address,
      CROWDSALE_DURATION
    );
    await tx.wait();

    // Get the first (and only) warehouse struct
    const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(0)
    const tokenAddress = tokenAddresses[0]
    const crowdsaleAddress = crowdsaleAddresses[0]

    // Check event emission
    expect(tx).to.emit(wareblock, 'WarehouseAdded').withArgs(tokenAddresses, crowdsaleAddresses)

    // Get an instance of the already deployed token
    const WarehouseToken = await ethers.getContractFactory("WarehouseToken");
    const warehouseToken = await WarehouseToken.attach(tokenAddress)

    const WarehouseCrowdsale = await ethers.getContractFactory("WarehouseCrowdsale");
    const warehouseCrowdsale = await WarehouseCrowdsale.attach(crowdsaleAddress)
    expect(await warehouseToken.balanceOf(warehouseCrowdsale.address)).to.equal(TOTAL_SUPPLY);

    // Make sure investing transaction succeeds
    let value = ethers.utils.parseEther('0.0001')
    let rate = await warehouseCrowdsale.rate()
    let buyTx = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })
    await buyTx.wait()
    let deposits = await warehouseCrowdsale.depositsOf(investor.address)
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(deposits.mul(rate));
  });

  it("Should return correct and up to date information using getAllWarehouses()", async function () {

    const [wareblockOwner, crowdsaleBeneficiary, investor] = await ethers.getSigners(); // Get first address
    let warehousesToDeploy = [
      // Test 1 land use
      {
        name: "Regie",
        symbol: "WB0",
        tokenURI: "https://wareblock.com/properties/regie.json",
        totalSupplies: [ethers.BigNumber.from(10).pow(TOKEN_DECIMALS).mul(10000)],
        goals: [ethers.constants.WeiPerEther.mul(1000)],
        duration: daysInSeconds(72)
      },
      // Test 3 land uses
      {
        name: "Basioudi",
        symbol: "WB1",
        tokenURI: "https://wareblock.com/properties/basioudi.json",
        totalSupplies: [
          ethers.BigNumber.from(10).pow(TOKEN_DECIMALS).mul(10000),
          ethers.BigNumber.from(10).pow(TOKEN_DECIMALS).mul(20000),
          ethers.BigNumber.from(10).pow(TOKEN_DECIMALS).mul(30000),
        ],
        goals: [
          ethers.constants.WeiPerEther.mul(1000),
          ethers.constants.WeiPerEther.mul(2000),
          ethers.constants.WeiPerEther.mul(3000),
        ],
        duration: daysInSeconds(90)
      }
    ]

    const Wareblock = await ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);
    await wareblock.deployed();

    // Deploy all warehouses and do some investing
    const VALUE = ethers.utils.parseEther('1') // DAI
    for (let i = 0; i < warehousesToDeploy.length; i++) {
      const wh = warehousesToDeploy[i]
      wh.tx = await wareblock.addWarehouse(
        wh.name,
        wh.symbol,
        wh.totalSupplies,
        wh.tokenURI,
        wh.goals,
        crowdsaleBeneficiary.address,
        wh.duration
      );
      await wh.tx.wait();

      const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(i)
      for (let j = 0; j < tokenAddresses.length; j++) {
        const tokenAddress = tokenAddresses[j]
        const crowdsaleAddress = crowdsaleAddresses[j]
        const WarehouseToken = await ethers.getContractFactory("WarehouseToken");
        const warehouseToken = await WarehouseToken.attach(tokenAddress)
        const WarehouseCrowdsale = await ethers.getContractFactory("WarehouseCrowdsale");
        const warehouseCrowdsale = await WarehouseCrowdsale.attach(crowdsaleAddress)

        let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, VALUE)
        await approveTx.wait()
        let buyTx = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, VALUE)
        await buyTx.wait();
      }

      // Note: this test could run faster if we await the addWarehouse()
      // and buyTokens() transctions in parallel
    }

    // Get all warehouses and verify their info is correct
    const warehousesInfo = await wareblock.getAllWarehouses()
    for (let i = 0; i < warehousesInfo.length; i++) {
      const wtd = warehousesToDeploy[i]
      const wh = warehousesInfo[i]
      const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(i)

      expect(wh.name).to.equal(wtd.name);
      expect(wh.symbol).to.equal(wtd.symbol);
      expect(wh.tokenURI).to.equal(wtd.tokenURI);
      const start = await getTxTimestamp(wtd.tx)
      expect(wh.closingTime).to.equal(start + wtd.duration);

      for (let j = 0; j < tokenAddresses.length; j++) {
        const tokenAddress = tokenAddresses[j]
        const crowdsaleAddress = crowdsaleAddresses[j]
        const use = wh.uses[j]
        expect(use.warehouseToken).to.equal(tokenAddress);
        expect(use.warehouseCrowdsale).to.equal(crowdsaleAddress);
        expect(use.totalSupply).to.equal(wtd.totalSupplies[j]);
        expect(use.goal).to.equal(wtd.goals[j]);
        expect(use.daiRaised).to.equal(VALUE);
        // Since investor invested once by paying VALUE DAI:
        //     supplyforSale = totalSupply - balanceOf(investor)
        //     balanceOf(investor) = VALUE * rate
        //     rate = totalSupply / goal
        expect(use.supplyforSale).to.equal(wtd.totalSupplies[j].sub(VALUE.mul(wtd.totalSupplies[j].div(wtd.goals[j]))));
        expect(use.rate).to.equal(wtd.totalSupplies[j].div(wtd.goals[j]));
      }
    }
  });
});
