require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");

const ALCHEMY_API_KEY = (process.env.ALCHEMY_API_KEY) ? process.env.ALCHEMY_API_KEY : null
const ROPSTEN_PRIVATE_KEY = (process.env.ROPSTEN_PRIVATE_KEY) ? process.env.ROPSTEN_PRIVATE_KEY : null
const COINMARKETCAP_API_KEY = (process.env.COINMARKETCAP_API_KEY) ? process.env.COINMARKETCAP_API_KEY : null

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
// https://hardhat.org/tutorial/deploying-to-a-live-network.html
module.exports = {
  solidity: {
    version: "0.8.8",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  // https://hardhat.org/plugins/hardhat-gas-reporter.html
  gasReporter: {
    currency: 'EUR',
    gasPrice: 40, // Gwei
    enabled: (process.env.REPORT_GAS) ? true : false,
    coinmarketcap: COINMARKETCAP_API_KEY
  },
};

if (ALCHEMY_API_KEY) {
  module.exports.networks = {
    hardhat: {
      // Add forking support based on ALCHEMY_API_KEY envvar
      // An Alchemy API key has been generated to be used by the Wareblock
      // platform. Ask Eleni for the key or create your own at
      // https://www.alchemy.com/
      // This is needed since we need to test our interactions with contracts
      // already deployed on Ropsten / Mainnet, such as DAI and Uniswap.
      forking: {
        url: ALCHEMY_API_KEY,
        // blockNumber: 13322262 // mainnet
        // Ropsten - after investor account has received DAI
        // (https://ropsten.etherscan.io/tx/0x6f81453b04c409a51cb52cf5730f8f897adc13ab871cf20567e1bd8669ccca4c)
        blockNumber: 11167053
      }
    }
  }

  if (ROPSTEN_PRIVATE_KEY) {
    module.exports.networks.ropsten = {
      url: ALCHEMY_API_KEY,
      accounts: [`0x${ROPSTEN_PRIVATE_KEY}`],
    }
  }

}
