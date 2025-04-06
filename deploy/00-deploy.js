const {network, deployments} = require("hardhat");
const {developmentChains} = require("../helper-hardhat-config");

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    if(developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        const MockDai = await deploy("MockDai", {
            contract: "MockDai",
            from: deployer,
            log: true
        });

        log("Deployed MockDai.");
        log("------------------------------------------");
        
        const daiAddress = MockDai.address;

        log(daiAddress);

        await deploy("MockV2Router02", {
            contract: "MockV2Router02",
            from: deployer,
            log: true,
            args: [daiAddress]
        });

        log("Deployed MockV2Router02.");
        log("------------------------------------------");
    }
}

module.exports.tags = ["all", "mocks"];