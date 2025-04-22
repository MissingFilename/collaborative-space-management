const { expect } = require("chai");

const { daysInSeconds, DAI_ADDRESS_BY_NETWORK_NAME } = require('../helpers');

describe("WarehouseToken", function () {
  const DECIMALS = 18 // Constant for all tokens
  const NAME = "Regie"
  const SYMBOL = "WB0"
  const TOTAL_SUPPLY = ethers.constants.WeiPerEther.mul(10000)
  const TOKEN_URI = "https://wareblock.com/properties/regie" // Example
  const GOAL = ethers.constants.WeiPerEther.mul(1000)
  const CROWDSALE_DURATION = daysInSeconds(90)
  const DEADLINE = 7961186785 // = April 2222. We don't care about ETH-DAI swap deadline during testing

  let daiAddress
  before(async function() {
    let { name } = await ethers.provider.getNetwork()
    daiAddress = DAI_ADDRESS_BY_NETWORK_NAME[name]
  })

  // Deploy Wareblock contract, add a warehouse and get instances of the
  // WarehouseToken and WarehouseCrowdsale contracts
  beforeEach(async function() {
    [wareblockOwner, crowdsaleBeneficiary, investor, anotherInvestor] = await ethers.getSigners();
    const Wareblock = await ethers.getContractFactory("Wareblock");
    wareblock = await Wareblock.deploy(daiAddress);
    wareblock.deployed();

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

    const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(0)
    const tokenAddress = tokenAddresses[0]
    const crowdsaleAddress = crowdsaleAddresses[0]

    const WarehouseToken = await ethers.getContractFactory("WarehouseToken");
    warehouseToken = await WarehouseToken.attach(tokenAddress)

    const WarehouseCrowdsale = await ethers.getContractFactory("WarehouseCrowdsale");
    warehouseCrowdsale = await WarehouseCrowdsale.attach(crowdsaleAddress)

  })

  it("Should initialize token details and total supply correctly", async function () {
    expect(await warehouseToken.name()).to.equal(NAME);
    expect(await warehouseToken.symbol()).to.equal(SYMBOL);
    expect(await warehouseToken.decimals()).to.equal(DECIMALS);
    expect(await warehouseToken.tokenURI()).to.equal(TOKEN_URI);

    // Total supply is transferred to the crowdsale inside addWarehouse
    expect(await warehouseToken.balanceOf(warehouseCrowdsale.address)).to.equal(TOTAL_SUPPLY);
  });

  it("Should only allow owner to set the crowdsale address", async function () {
    expect(warehouseToken.connect(investor).setCrowdsaleAddress(investor.address)).to.be.revertedWith('WarehouseToken: Owner-only operation');
  });

  it("Should only allow crowdsale to destroy tokens on behalf of investors", async function () {
    let value = 1
    let buyTx = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })
    await buyTx.wait()

    expect(warehouseToken.connect(anotherInvestor).destroyFrom(investor.address, value)).to.be.revertedWith('WarehouseToken: Crowdsale-only operation');
  });
});
