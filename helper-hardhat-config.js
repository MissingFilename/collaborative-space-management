const networkConfig = {
    11155111: {
        name: "sepolia",
        ethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    },
}

const developmentChains = ["hardhat", "localhost"];

const DAI_ADDRESS_BY_NETWORK_NAME = {
    "sepolia": "0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6"
}

module.exports = {
    networkConfig,
    developmentChains,
    DAI_ADDRESS_BY_NETWORK_NAME
}