const {getNamedAccounts, ethers, network, deployments} = require("hardhat");
const {utils} = require("ethers");

async function main() {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();
    const signers = await ethers.getSigners();
    const tokenOwner = signers[0];

    console.log("Retrieving WarehouseToken...");

    const warehouseToken = await ethers.getContract("WarehouseToken", deployer);

    console.log(`Token address is ${await warehouseToken.getAddress()}`);

    await warehouseToken.transfer(signers[1], 1000000000);
    await warehouseToken.transfer(signers[2], 1000000000);
    await warehouseToken.transfer(signers[3], 1000000000);
    await warehouseToken.transfer(signers[4], 1000000000);

    console.log(`Balances are: ${await warehouseToken.balanceOf(signers[1])}`);
    console.log(`Balances are: ${await warehouseToken.balanceOf(signers[2])}`);
    console.log(`Balances are: ${await warehouseToken.balanceOf(signers[3])}`);
    console.log(`Balances are: ${await warehouseToken.balanceOf(signers[4])}`);

    const stakeholders = await Promise.all([signers[1].getAddress(), signers[2].getAddress(), signers[3].getAddress(), signers[4].getAddress()]);

    await deploy ("RealEstate", {
        from: deployer,
        args: [await warehouseToken.getAddress(), 20, 13, stakeholders],
        log: true,
        blockConfirmations: network.config.blockConfirmations || 1
    });

    const realEstate = await ethers.getContract("RealEstate", deployer);

    console.log(`realEstate contract deployed on address ${await realEstate.address}`);

    console.log(`Approve tenant at address: ${await signers[5].getAddress()} and set rent`);

    await realEstate.setRentper30Day(ethers.parseEther("200"));
    await realEstate.canPayRent(await signers[5].getAddress());

    console.log(`Tenant pays rent...`);

    const realEstate_renter = await realEstate.connect(signers[5]);

    let response = await realEstate_renter.payRent(1, {value: ethers.parseEther("200")});

    console.log(`Tenant's balance is: ${await ethers.provider.getBalance(await signers[5].getAddress())}`);
    
    console.log(`Rent has been payed, time to distribute funds`);

    await realEstate.distribute();

    let balance = await ethers.provider.getBalance(await signers[1].getAddress());
    console.log(`Stakeholder#1 balance before: ${balance}`);
    
    const realEstate_stakeholder = await realEstate.connect(signers[1]);

    await realEstate_stakeholder.withdraw();
    
    balance = await ethers.provider.getBalance(await signers[1].getAddress());
    console.log(`Stakeholder#1 balance after : ${balance}`);

}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});