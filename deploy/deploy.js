// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const { DAI_ADDRESS_BY_NETWORK_NAME } = require('../helper-hardhat-config');

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile
    // manually to make sure everything is compiled
    // await hre.run('compile');


    let { name } = await hre.ethers.provider.getNetwork()
    daiAddress = DAI_ADDRESS_BY_NETWORK_NAME[name]

    // We get the contract to deploy
    const Wareblock = await hre.ethers.getContractFactory("Wareblock");
    const wareblock = await Wareblock.deploy(daiAddress);

    await wareblock.deployed();

    console.log("Wareblock deployed to:", wareblock.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
