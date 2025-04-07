const {network} = require("hardhat");
const {networkConfig, DAI_ADDRESS_BY_NETWORK_NAME} = require("../helper-hardhat-config");

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    const networkName = network.name;
    let daiAddress, routerAddress;
    
    if(networkName == "sepolia") {

    }
    else {
        const daiContract = await deployments.get("MockDai");
        daiAddress = daiContract.address;
        const routerContract = await deployments.get("MockV2Router02");
        routerAddress = routerContract.address;
    }

    log(daiAddress);
    log(routerAddress);

    const tokenFactoryLibrary = await deploy ("TokenFactory", {
        from: deployer,
        log: true
    });

    const CrowdsaleFactoryLibrary = await deploy("CrowdsaleFactory", {
        from: deployer,
        log: true
    });

    const Wareblock = await deploy("Wareblock", {
        from: deployer,
        args: [daiAddress, routerAddress],
        log: true,
        libraries: {
            TokenFactory: tokenFactoryLibrary.address,
            CrowdsaleFactory: CrowdsaleFactoryLibrary.address,
        },
        blockConfirmations: network.config.blockConfirmations || 1,
    });

    log("-------------------------------------------------------");
}

module.exports.tags = ["all", "Wareblock"];