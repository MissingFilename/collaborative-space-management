const {network} = require("hardhat");

module.exports = async ({getNamedAccounts, deployments}) => {
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();

    const WarehouseToken = await deploy ("WarehouseToken", {
        from: deployer,
        log: true,
        args: ["Apothikious", "APO", 10000000000, ""]
    });



    await deploy("WarehouseGovernor", {
        from: deployer,
        log: true,
        args: [WarehouseToken.address],
        blockConfirmations: network.config.blockConfirmations || 1,
    });

    log("-------------------------------------------------------");

}

module.exports.tags = ["all", "Governor"];