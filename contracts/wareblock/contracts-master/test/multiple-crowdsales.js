const { expect } = require("chai");

const { getTxTimestamp, daysInSeconds, setNextBlockTimestamp, getEthDaiRate, getMinExpectedDai, DAI_ADDRESS_BY_NETWORK_NAME } = require('../helpers');

describe("WarehouseCrowdsale (multiple land uses)", function () {
  const DECIMALS = 18 // Constant for all tokens
  const NAME = "Regie"
  const SYMBOL = "WB0"
  const TOKEN_URI = "https://wareblock.com/properties/regie" // Example
  const TOTAL_SUPPLIES = [
    ethers.constants.WeiPerEther.mul(10000),
    ethers.constants.WeiPerEther.mul(20000),
    ethers.constants.WeiPerEther.mul(30000)
  ]
  const GOALS = [
    ethers.constants.WeiPerEther.mul(10),
    ethers.constants.WeiPerEther.mul(20),
    ethers.constants.WeiPerEther.mul(30)
  ]
  const CROWDSALE_DURATION = daysInSeconds(90)
  const DEADLINE = 7961186785 // = April 2222. We don't care about ETH-DAI swap deadline during testing

  // These vars will be updated inside beforeEach() or before()
  let daiAddress
  let wareblock, warehouseTokens, warehouseCrowdsales, dai // Contract instances
  let wareblockOwner, crowdsaleBeneficiary, investor, anotherInvestor // Accounts
  let closingTime

  before(async function() {
    let { name } = await ethers.provider.getNetwork()
    daiAddress = DAI_ADDRESS_BY_NETWORK_NAME[name]
    dai = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20", daiAddress)
  })

  // Deploy Wareblock contract, add a warehouse and get instances of the
  // WarehouseToken and WarehouseCrowdsale contracts
  beforeEach(async function() {
    [wareblockOwner, crowdsaleBeneficiary, investor, anotherInvestor] = await ethers.getSigners();

    const Wareblock = await ethers.getContractFactory("Wareblock");
    wareblock = await Wareblock.deploy(daiAddress);
    wareblock.deployed();

    tx = await wareblock.addWarehouse(
      NAME,
      SYMBOL,
      TOTAL_SUPPLIES,
      TOKEN_URI,
      GOALS,
      crowdsaleBeneficiary.address,
      CROWDSALE_DURATION
    );
    await tx.wait();
    const start = await getTxTimestamp(tx)
    closingTime = start + CROWDSALE_DURATION

    const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(0)

    const WarehouseToken = await ethers.getContractFactory("WarehouseToken");
    const WarehouseCrowdsale = await ethers.getContractFactory("WarehouseCrowdsale");
    warehouseTokens = new Array(tokenAddresses.length).fill(null);
    warehouseCrowdsales = new Array(tokenAddresses.length).fill(null);
    for (let i = 0; i < tokenAddresses.length; i++) {
      warehouseTokens[i] = await WarehouseToken.attach(tokenAddresses[i])
      warehouseCrowdsales[i] = await WarehouseCrowdsale.attach(crowdsaleAddresses[i])
    }
  })

  it("Should initialize crowdsale details correctly", async function () {
    for (let i = 0; i < warehouseCrowdsales.length; i++) {
      const warehouseCrowdsale = warehouseCrowdsales[i]
      expect(await warehouseCrowdsale.goal()).to.equal(GOALS[i]);
      expect(await warehouseCrowdsale.closingTime()).to.equal(closingTime);
      expect(await warehouseCrowdsale.token()).to.equal(warehouseTokens[i].address);
      expect(await warehouseCrowdsale.wallet()).to.equal(crowdsaleBeneficiary.address);
      expect(await warehouseCrowdsale.rate()).to.equal(TOTAL_SUPPLIES[i].div(GOALS[i]));
    }
  });

  it("Should prevent token sale after the crowdsale is over", async function () {
    const warehouseCrowdsale = warehouseCrowdsales[0]

    let value = ethers.utils.parseEther('0.0001')

    await setNextBlockTimestamp(closingTime + 100)

    // Try buyTokens()
    expect(warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })).to.be.revertedWith('WarehouseCrowdsale: not open');

    // Try buyTokensWithDai()
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    expect(warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)).to.be.revertedWith('WarehouseCrowdsale: not open');
  });

  it("Should prevent token sale if the goal of another land use was reached", async function () {
    const successfulCrowdsale = warehouseCrowdsales[0]
    const warehouseCrowdsale = warehouseCrowdsales[1]

    let value = await successfulCrowdsale.goal()
    let investorDaiBefore = await dai.balanceOf(investor.address)
    expect(await successfulCrowdsale.goalReached()).to.equal(false);
    let approveTx = await dai.connect(investor).approve(successfulCrowdsale.address, value)
    await approveTx.wait()
    let tx1 = await successfulCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    expect(await successfulCrowdsale.goalReached()).to.equal(true);
    expect(await warehouseCrowdsale.goalReached()).to.equal(false);
    expect(warehouseCrowdsale.connect(anotherInvestor).buyTokens(anotherInvestor.address, 1, DEADLINE, { value: 1 }))
      .to.be.revertedWith('WarehouseCrowdsale: A different land use for this warehouse has reached its goal');
  });


  it("Should allow refunds if the goal of another land use is reached (open crowdsale)", async function () {
    const successfulCrowdsale = warehouseCrowdsales[0]
    const warehouseCrowdsale = warehouseCrowdsales[1]
    const warehouseToken = warehouseTokens[1]

    let goal = await successfulCrowdsale.goal()
    let investorDaiBefore = await dai.balanceOf(investor.address)
    expect(await successfulCrowdsale.goalReached()).to.equal(false);
    let approveTx = await dai.connect(investor).approve(successfulCrowdsale.address, goal)
    await approveTx.wait()

    // Invest a little bit on warehouseCrowdsale
    let value = 1
    let approveTx1 = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx1.wait()
    let tx1 = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await tx1.wait()

    // Reach goal on successfulCrowdsale
    let approveTx2 = await dai.connect(investor).approve(successfulCrowdsale.address, goal)
    await approveTx2.wait()
    let tx2 = await successfulCrowdsale.connect(investor).buyTokensWithDai(investor.address, goal)
    await tx2.wait()

    let investorDaiAfterInvestments = await dai.balanceOf(investor.address)
    expect(investorDaiAfterInvestments).to.equal(investorDaiBefore.sub(value).sub(goal));

    expect(await successfulCrowdsale.goalReached()).to.equal(true);
    expect(await warehouseCrowdsale.goalReached()).to.equal(false);

    // Get the amount of purchased DAI
    let deposits1 = await warehouseCrowdsale.depositsOf(investor.address)
    let deposits2 = await successfulCrowdsale.depositsOf(investor.address)
    expect(deposits1).to.equal(value);
    expect(deposits2).to.equal(goal);

    let refundTx = await warehouseCrowdsale.connect(investor).claimRefund({ gasPrice: 0 })
    await refundTx.wait()
    // Add the refunded investment (deposits1) to the balance after investments
    expect(await dai.balanceOf(investor.address)).to.equal(investorDaiAfterInvestments.add(deposits1));
    // Tokens should be burned
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(0);
  });

  it("Should allow refunds if the goal of another land use is reached (closed crowdsale)", async function () {
    const successfulCrowdsale = warehouseCrowdsales[0]
    const warehouseCrowdsale = warehouseCrowdsales[1]
    const warehouseToken = warehouseTokens[1]

    let goal = await successfulCrowdsale.goal()
    let investorDaiBefore = await dai.balanceOf(investor.address)
    expect(await successfulCrowdsale.goalReached()).to.equal(false);
    let approveTx = await dai.connect(investor).approve(successfulCrowdsale.address, goal)
    await approveTx.wait()

    // Invest a little bit on warehouseCrowdsale
    let value = 1
    let approveTx1 = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx1.wait()
    let tx1 = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await tx1.wait()

    // Reach goal on successfulCrowdsale
    let approveTx2 = await dai.connect(investor).approve(successfulCrowdsale.address, goal)
    await approveTx2.wait()
    let tx2 = await successfulCrowdsale.connect(investor).buyTokensWithDai(investor.address, goal)
    await tx2.wait()
    await setNextBlockTimestamp(closingTime + 1)

    let investorDaiAfterInvestments = await dai.balanceOf(investor.address)
    expect(investorDaiAfterInvestments).to.equal(investorDaiBefore.sub(value).sub(goal));

    expect(await successfulCrowdsale.goalReached()).to.equal(true);
    expect(await warehouseCrowdsale.goalReached()).to.equal(false);

    // Get the amount of purchased DAI
    let deposits1 = await warehouseCrowdsale.depositsOf(investor.address)
    let deposits2 = await successfulCrowdsale.depositsOf(investor.address)
    expect(deposits1).to.equal(value);
    expect(deposits2).to.equal(goal);

    let refundTx = await warehouseCrowdsale.connect(investor).claimRefund({ gasPrice: 0 })
    await refundTx.wait()
    // Add the refunded investment (deposits1) to the balance after investments
    expect(await dai.balanceOf(investor.address)).to.equal(investorDaiAfterInvestments.add(deposits1));
    // Tokens should be burned
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(0);
  });

  it("Should prevent refunds if the goal is reached", async function () {
    const warehouseCrowdsale = warehouseCrowdsales[0]

    // let investorDaiBefore = await dai.balanceOf(investor.address)
    let value = await warehouseCrowdsale.goal()
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    let tx = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await tx.wait()
    await setNextBlockTimestamp(closingTime + 1)

    expect(await warehouseCrowdsale.goalReached()).to.equal(true);
    expect(warehouseCrowdsale.connect(investor).claimRefund()).to.be.revertedWith('WarehouseCrowdsale: Refund not allowed');
  });

  it("Should prevent refunds while the crowdsale is open", async function () {
    const warehouseCrowdsale = warehouseCrowdsales[0]
    let tx = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: 1 })
    await tx.wait()
    // Immediately try to refund
    expect(warehouseCrowdsale.connect(investor).claimRefund()).to.be.revertedWith('WarehouseCrowdsale: Refund not allowed');
  });

  it("Should prevent token sale if the goal was reached", async function () {
    const warehouseCrowdsale = warehouseCrowdsales[0]
    let value = await warehouseCrowdsale.goal()
    let investorDai = await dai.balanceOf(investor.address)
    expect(await warehouseCrowdsale.goalReached()).to.equal(false);
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    let tx1 = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    expect(await warehouseCrowdsale.goalReached()).to.equal(true);
    expect(warehouseCrowdsale.connect(anotherInvestor).buyTokens(anotherInvestor.address, 1, DEADLINE, { value: 1 }))
      .to.be.revertedWith('WarehouseCrowdsale: goal exceeded');
  });

  it("Should allow refunds if the goal is not reached", async function () {
    const warehouseCrowdsale = warehouseCrowdsales[0]
    const warehouseToken = warehouseTokens[0]

    let value = ethers.utils.parseEther('0.001')
    let investorDaiBefore = await dai.balanceOf(investor.address)

    // Two investments in a row
    // Buy with Ether
    let tx1 = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })
    await tx1.wait()
    let tx2 = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })
    await tx2.wait()
    await setNextBlockTimestamp(closingTime + 1)

    // Get the amount of purchased DAI
    let deposits = await warehouseCrowdsale.depositsOf(investor.address)

    // Refund
    // Investment should be returned in DAI
    let refundTx = await warehouseCrowdsale.connect(investor).claimRefund({ gasPrice: 0 })
    await refundTx.wait()
    expect(await dai.balanceOf(investor.address)).to.equal(investorDaiBefore.add(deposits));
    // Tokens should be burned
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(0);
  });
});
