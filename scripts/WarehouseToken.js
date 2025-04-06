const {getNamedAccounts, ethers} = require("hardhat");

async function main () 
{
    const {deployer} = await getNamedAccounts();
    const WarehouseToken = await ethers.getContract("WarehouseToken", deployer);

    console.log("Creating WarehouseToken...");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);    
    });