// This is constant for all tokens used in Wareblock
// Mimics the relationship between wei and ether
exports.TOKEN_DECIMALS = 18

exports.DAI_ADDRESS_BY_NETWORK_NAME = {
  ropsten: "0xad6d458402f60fd3bd25163575031acdce07538d",
  mainnet: "0x6b175474e89094c44da98b954eedeac495271d0f",
  // Hardhat or forked network: Use Ropsten address
  unknown: "0xad6d458402f60fd3bd25163575031acdce07538d"
}

// Returns the block timestamp of the block which includes transaction tx,
// given the tx object
exports.getTxTimestamp = async tx => {
  let b = await ethers.provider.getBlock(tx.blockNumber)
  return b.timestamp
}
exports.daysInSeconds = ndays => ndays * 24 * 60 * 60
exports.setNextBlockTimestamp = async (ts) => {
  await network.provider.send("evm_setNextBlockTimestamp", [ts]);
  await network.provider.send("evm_mine");
}

// !! Placeholder function !!
// This rate should ideally be retreived from an oracle.
// On-chain oracle: Use instance of the following contract
// https://github.com/Keydonix/uniswap-oracle/
// Off-chain oracle: Else, get the ETH/USD rate through some API
// For testing, we use the value of DAI shown in the Uniswap app on the
// Ropsten around block 11167053, where our investor account received DAI.
// TODO: use an oracle if testing on Mainnet
exports.getEthDaiRate = () => 360

const UNISWAP_FEE = 0.003 // 0.3% liquidity fee - Percentage of input amount
const ALLOWED_SLIPPAGE = 0.005 // Percentage of output amount
// TODO price impact due to insufficient liquidity is ignored here
exports.getMinExpectedDai = (value) => {
  let ethDaiRate = exports.getEthDaiRate()
  const expectedDai = value.sub(value * UNISWAP_FEE).mul(ethDaiRate)
  // Minimum expected DAI after subtracting allowed slippage
  return expectedDai.sub(expectedDai * ALLOWED_SLIPPAGE)
}

