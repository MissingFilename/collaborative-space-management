const { expect } = require("chai");

const { getTxTimestamp, daysInSeconds, setNextBlockTimestamp, getEthDaiRate, getMinExpectedDai, DAI_ADDRESS_BY_NETWORK_NAME } = require('../helpers');

describe("WarehouseCrowdsale", function () {
  const DECIMALS = 18 // Constant for all tokens
  const NAME = "Regie"
  const SYMBOL = "WB0"
  const TOTAL_SUPPLY = ethers.constants.WeiPerEther.mul(10000)
  const TOKEN_URI = "https://wareblock.com/properties/regie" // Example
  const GOAL = ethers.constants.WeiPerEther.mul(10) // DAI = USD
  const CROWDSALE_DURATION = daysInSeconds(90)
  const DEADLINE = 7961186785 // = April 2222. We don't care about ETH-DAI swap deadline during testing

  // These vars will be updated inside beforeEach() or before()
  let daiAddress
  let wareblock, warehouseToken, warehouseCrowdsale, dai // Contract instances
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
      [TOTAL_SUPPLY],
      TOKEN_URI,
      [GOAL],
      crowdsaleBeneficiary.address,
      CROWDSALE_DURATION
    );
    await tx.wait();
    const start = await getTxTimestamp(tx)
    closingTime = start + CROWDSALE_DURATION

    const [tokenAddresses, crowdsaleAddresses] = await wareblock.getWarehouse(0)
    const tokenAddress = tokenAddresses[0]
    const crowdsaleAddress = crowdsaleAddresses[0]

    const WarehouseToken = await ethers.getContractFactory("WarehouseToken");
    warehouseToken = await WarehouseToken.attach(tokenAddress)

    const WarehouseCrowdsale = await ethers.getContractFactory("WarehouseCrowdsale");
    warehouseCrowdsale = await WarehouseCrowdsale.attach(crowdsaleAddress)
  })

  it("Should initialize crowdsale details correctly", async function () {
    expect(await warehouseCrowdsale.goal()).to.equal(GOAL);
    expect(await warehouseCrowdsale.closingTime()).to.equal(closingTime);
    expect(await warehouseCrowdsale.token()).to.equal(warehouseToken.address);
    expect(await warehouseCrowdsale.wallet()).to.equal(crowdsaleBeneficiary.address);
    expect(await warehouseCrowdsale.rate()).to.equal(TOTAL_SUPPLY.div(GOAL));
  });

  it("Should sell tokens with the correct rate", async function () {
    let value = ethers.utils.parseEther('0.0001')
    let rate = await warehouseCrowdsale.rate()
    let crowdsaleDaiBefore = await dai.balanceOf(warehouseCrowdsale.address)
    let buyTx = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, getMinExpectedDai(value), DEADLINE, { value: value })
    await buyTx.wait()
    let daiDeposited = await warehouseCrowdsale.depositsOf(investor.address)
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(daiDeposited.mul(rate));
    expect(await dai.balanceOf(warehouseCrowdsale.address)).to.equal(crowdsaleDaiBefore.add(daiDeposited));
  });

  it("Should sell tokens for DAI with the correct rate", async function () {
    // We can use parseEther for DAI as well since both ETH and DAI have the
    // same number (18) of decimals.
    let value = ethers.utils.parseEther('0.0001')
    // DAI is an ERC20 token so we need to approve first
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()

    // Verify that contract can transfer DAI from the investor to itself
    expect(await dai.allowance(investor.address, warehouseCrowdsale.address), value)

    let rate = await warehouseCrowdsale.rate()

    let tokensBefore = await warehouseToken.balanceOf(investor.address)
    let investorDaiBefore = await dai.balanceOf(investor.address)
    let crowdsaleDaiBefore = await dai.balanceOf(warehouseCrowdsale.address)

    let buyTx = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await buyTx.wait()

    // Investor should give DAI
    expect(await dai.balanceOf(investor.address)).to.equal(investorDaiBefore.sub(value));
    // Crowdsale should get DAI
    expect(await dai.balanceOf(warehouseCrowdsale.address)).to.equal(crowdsaleDaiBefore.add(value));
    // Investor should get tokens
    expect(await warehouseToken.balanceOf(investor.address)).to.equal(tokensBefore.add(value.mul(rate)));
  });

  it("Should prevent token sale after the crowdsale is over", async function () {
    let value = ethers.utils.parseEther('0.0001')

    await setNextBlockTimestamp(closingTime + 100)

    // Try buyTokens()
    expect(warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: value })).to.be.revertedWith('WarehouseCrowdsale: not open');

    // Try buyTokensWithDai()
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    expect(warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)).to.be.revertedWith('WarehouseCrowdsale: not open');
  });

  it("Should prevent token sale if the goal was reached", async function () {
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

  it("Should prevent refunds while the crowdsale is open", async function () {
    let tx = await warehouseCrowdsale.connect(investor).buyTokens(investor.address, 1, DEADLINE, { value: 1 })
    await tx.wait()
    // Immediately try to refund
    expect(warehouseCrowdsale.connect(investor).claimRefund()).to.be.revertedWith('WarehouseCrowdsale: Refund not allowed');
  });

  it("Should prevent refunds if the goal is reached", async function () {
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

  it("Should allow refunds if the goal is not reached", async function () {
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

  it("Should not allow the same investor to refund more than once", async function () {
    let value = 1

    let approveTx1 = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx1.wait()
    let investTx1 = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await investTx1.wait()

    await setNextBlockTimestamp(closingTime + 1)

    // Refund 1 (should return ether)
    await expect(() => warehouseCrowdsale.connect(investor).claimRefund({ gasPrice: 0 }))
      .to.changeTokenBalance(dai, investor, value);
    // Refund 2 (should fail or not change ether balance)
    // Usually ERC20 transfers of 0 tokens fail
    // expect(warehouseCrowdsale.connect(investor).claimRefund()).to.be.revertedWith("<reason>")
    // Ether crowdsale simply sends 0 wei
    await expect(() => warehouseCrowdsale.connect(investor).claimRefund({ gasPrice: 0 }))
      .to.changeTokenBalance(dai, investor, 0);
  });

  it("Should allow beneficiary to withdraw funds if the goal is reached", async function () {
    let investorDaiBefore = await dai.balanceOf(investor.address)
    let value = await warehouseCrowdsale.goal()
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    let tx = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value)
    await tx.wait()
    await setNextBlockTimestamp(closingTime + 1)

    expect(await warehouseCrowdsale.goalReached()).to.equal(true);
    await expect(() => warehouseCrowdsale.connect(crowdsaleBeneficiary).beneficiaryWithdraw({ gasPrice: 0 }))
      .to.changeTokenBalance(dai, crowdsaleBeneficiary, value);
  });

  it("Should not allow beneficiary to withdraw funds if the goal is not reached", async function () {
    let investorDaiBefore = await dai.balanceOf(investor.address)
    let value = await warehouseCrowdsale.goal()
    let approveTx = await dai.connect(investor).approve(warehouseCrowdsale.address, value)
    await approveTx.wait()
    let tx = await warehouseCrowdsale.connect(investor).buyTokensWithDai(investor.address, value.sub(1))
    await tx.wait()
    await setNextBlockTimestamp(closingTime + 1)

    expect(await warehouseCrowdsale.goalReached()).to.equal(false);
    expect(warehouseCrowdsale.connect(crowdsaleBeneficiary).beneficiaryWithdraw({ gasPrice: 0 })).to.be.revertedWith('WarehouseCrowdsale: beneficiary can only withdraw after goal is reached');
  });

});
