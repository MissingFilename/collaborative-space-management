const {deployments, ethers, getNamedAccounts, network} = require("hardhat");
const {developmentChains} = require("../../helper-hardhat-config");    
const {assert, expect} = require("chai");

!developmentChains.includes(network.name) ? describe.skip: 
describe("Wareblock", async function () {
    let deployer;
    let MockDai, MockV2Router;

    beforeEach(async function () {
        await deployments.fixture(["all"]);

        deployer = (await getNamedAccounts()).deployer;

        MockDai = await ethers.getContract("MockDai", deployer);
        //console.log("MockDai:", await MockDai?.getAddress());
        MockV2Router = await ethers.getContract("MockV2Router02", deployer);
        //console.log("MockV2Router:", await MockV2Router?.getAddress());
        Wareblock = await ethers.getContract("Wareblock", deployer);

    });

    /**
     * @notice here we test the mock implementation of the DAI
     */
    describe("MockDai", async function() {
        it("Should init the MockDAI with a total supply of 500M tokens", async function() {
            let balance = await MockDai.balanceOf(deployer);
            let expected = ethers.parseUnits("500000000", 18);
            assert.equal(balance.toString(), expected.toString());
        });

        it("Should transfer from account1, to account 2", async function () {
            const account2 = (await ethers.getSigners())[1];
            await MockDai.transfer(account2.getAddress(), ethers.parseUnits("100000000", 18));
            
            const expected1 = ethers.parseUnits("400000000", 18);
            const expected2 = ethers.parseUnits("100000000", 18);

            const balance1  = await MockDai.balanceOf(deployer);
            const balance2 = await MockDai.balanceOf(account2.getAddress());
            assert.equal(balance1.toString(), expected1.toString());
            assert.equal(balance2.toString(), expected2.toString());
        });
    });

    describe("MockV2Router", async function () {
        beforeEach(async function () {
            await MockDai.transfer(MockV2Router.getAddress(), ethers.parseEther("10000"));
        });

        it("Should swap ETH for DAI", async function () {
            const ethAmount = ethers.parseEther("1");
            const amountOutMin = ethers.parseEther("1");

            const wethAddress = await MockV2Router.WETH();

            const path = [wethAddress, await MockDai.getAddress()];

            const deadline = Math.floor(Date.now() / 1000) + 60;
            const account2 = (await ethers.getSigners())[1];

            const userBalanceBefore = await MockDai.balanceOf(account2.address);

            const accRouter = MockV2Router.connect(account2);

            await accRouter.swapETHForExactTokens(
                amountOutMin,
                path,
                account2.getAddress(), 
                deadline,
                { value: ethAmount }
            );

            const userBalanceAfter = await MockDai.balanceOf(account2.address);

            assert.equal(
                (userBalanceAfter - userBalanceBefore).toString(),
                ethAmount.toString()
            );
        
        });
    });

    describe("WarehouseToken", async function () {
        let WarehouseToken, Wareblock;
        
        beforeEach(async function (){
            WarehouseToken = await ethers.getContract("WarehouseToken", deployer);

            mDai = await ethers.getContract("MockDai", deployer);
            mRouter = await ethers.getContract("MockV2Router02", deployer);

            await mDai.transfer(mDai.getAddress(), ethers.parseEther("200000000"));
        });

        it("Should create the token with a token supply of 10B tokens", async function (){
            assert.equal((await WarehouseToken.balanceOf(deployer)).toString(), ethers.parseUnits("10000000000", 18));
        });

        it("Should transfer tokens from account1 to account2", async function () {
            const account2 = (await ethers.getSigners())[1];

            await WarehouseToken.transfer(account2.address, ethers.parseUnits("1000000000", 18));

            const deployer_balance = await WarehouseToken.balanceOf(deployer);
            const balance = await WarehouseToken.balanceOf(account2.address);

            assert.equal(deployer_balance.toString(), ethers.parseUnits("9000000000", 18));
            assert.equal(balance.toString(), ethers.parseUnits("1000000000", 18));
            
        });
    });

    describe("Crowdfund", async function() {
        beforeEach(async function () {
            Wareblock = await ethers.getContract("Wareblock");
            const tx = await Wareblock.addWarehouse(
                "Apothiki",
                "APO",
                [ethers.parseEther("10000")],
                "",
                [ethers.parseEther("10000")],
                deployer,
                60
            );

            await tx.wait();

            await MockDai.transfer(MockV2Router.getAddress(), ethers.parseEther("10000"));

        });

        it("Should create a token and a crowdsale", async function() {
            const warehouse = await Wareblock.getWarehouse(0);

            const token_array = warehouse.warehouseTokens;
            const crowd_array = warehouse.warehouseCrowdsales;

            assert(token_array.length > 0, "No tokens found in warehouse");
            assert(crowd_array.length > 0, "No crowdsales found in warehouse");

            const other_wt = await ethers.getContractAt("WarehouseToken", token_array[0], (await ethers.getSigners())[0]);
            const other_wc = await ethers.getContractAt("WarehouseCrowdsale", crowd_array[0], (await ethers.getSigners())[0]);

            assert.equal(await other_wt.name(), "Apothiki");

            assert.equal(await other_wc.token(), await other_wt.getAddress());
        });

        it("Should correctly let the user buy tokens", async function () {
            const warehouse = await Wareblock.getWarehouse(0);

            const token_array = warehouse.warehouseTokens;
            const crowd_array = warehouse.warehouseCrowdsales;

            const other_wt = await ethers.getContractAt("WarehouseToken", token_array[0], (await ethers.getSigners())[0]);
            const other_wc = await ethers.getContractAt("WarehouseCrowdsale", crowd_array[0], (await ethers.getSigners())[0]);

            const account2 = (await ethers.getSigners())[2];
            const other_wc2 = other_wc.connect(account2);


            
            const tx = await other_wc2.buyTokens(account2.address, ethers.parseEther("1"), 6000000000000, {value: ethers.parseEther("1")});
            await tx.wait();

            const wt_balance = await other_wt.balanceOf(account2.address);
            assert.equal(wt_balance.toString(), ethers.parseEther("1"));
        });
    });

    describe("Governor", async function () {
        beforeEach(async function () {

        });

        it(" ", async function () {

        });
    });

    describe("Real Estate", async function () {
        beforeEach(async function () {

        });

        it(" ", async function () {
            
        });
    });
});