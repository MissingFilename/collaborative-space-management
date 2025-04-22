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
        let governor, warehouseToken, voter1, voter2, nonVoter, targetContract, callData;
        beforeEach(async function () {
            voter1 = (await ethers.getSigners())[1];
            voter2 = (await ethers.getSigners())[2];
            nonVoter = (await ethers.getSigners())[3];
            
            warehouseToken = await ethers.getContract("WarehouseToken", deployer);

            governor = await ethers.getContract("WarehouseGovernor", deployer);

            targetContract = await ethers.getContract("NothingContract", deployer);

            await warehouseToken.transfer(voter1.address, ethers.parseEther("100"));
            await warehouseToken.transfer(voter2.address, ethers.parseEther("50"));

            await warehouseToken.delegate(deployer);
            await warehouseToken.connect(voter1).delegate(voter1.address);
            await warehouseToken.connect(voter2).delegate(voter2.address);

            await ethers.provider.send("evm_mine", []);

            callData = targetContract.interface.encodeFunctionData("setValue", [42]);

        });

        it("Should let a token owner pass a proposal", async function () {
            const votingPower = await warehouseToken.getVotes(deployer);
            const proposalThreshold = await governor.proposalThreshold();

            expect(votingPower).to.be.gte(proposalThreshold);

            const tx = await governor.propose(
                [await targetContract.getAddress()],
                [0],
                [callData],
                "Set value in nothingContract to 42"
            );

            const rcpt = await tx.wait();

            const events = await governor.queryFilter("ProposalCreated", rcpt.blockNumber);
            const proposalId = events[0].args.proposalId;

            expect(await governor.state(proposalId)).to.equal(0);
            
            //mined two blocks just to be sure.
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);
            
            expect(await governor.state(proposalId)).to.equal(1);

        });

        it("Should let only token owners vote on the proposal", async function () {
            const tx = await governor.propose(
                [await targetContract.getAddress()],
                [0],
                [callData],
                "Set value in nothingContract to 42"
            );

            const rcpt = await tx.wait();

            const events = await governor.queryFilter("ProposalCreated", rcpt.blockNumber);
            const proposalId = events[0].args.proposalId;

            //mined two blocks just to be sure.
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);

            await governor.castVote(proposalId, 1);
            
            await governor.connect(voter1).castVote(proposalId, 1);

            expect(
                await governor.connect(nonVoter).castVote(proposalId, 1)
            ).to.be.reverted;

            const proposalVotes = await governor.proposalVotes(proposalId);

            const expectedForVotes = (await warehouseToken.getVotes(deployer)) + (await warehouseToken.getVotes(voter1.getAddress()));

            assert.equal(proposalVotes.forVotes, expectedForVotes);
        });

        it("Should end vote when enough votes have been submitted", async function () {
            const tx = await governor.propose(
                [await targetContract.getAddress()],
                [0],
                [callData],
                "Set value in nothingContract to 42"
            );

            const rcpt = await tx.wait();

            const events = await governor.queryFilter("ProposalCreated", rcpt.blockNumber);
            const proposalId = events[0].args.proposalId;

            //mined two blocks just to be sure.
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);

            await governor.castVote(proposalId, 1);
            await governor.connect(voter1).castVote(proposalId, 1);
            await governor.connect(voter2).castVote(proposalId, 1);

            const quorum = await governor.quorum(0);
            const proposalVotes = await governor.proposalVotes(proposalId);
            
            assert(proposalVotes.forVotes >= quorum);

            const votingPeriod = await governor.votingPeriod();

            for(let i=0; i<votingPeriod; i++) {
                await ethers.provider.send("evm_mine", []);
            }

            expect(await governor.state(proposalId)).to.equal(4);

            await governor.execute(
                [targetContract.getAddress()],
                [0],
                [callData],
                ethers.id("Set value in nothingContract to 42")
            );

            assert.equal(await governor.state(proposalId), 7);
            assert.equal(await targetContract.getValue(), 42);
        });

        
    });

    describe("Real Estate", async function () {
        let realEstate, warehouseToken, stakeholder1, stakeholder2, tenant;
        beforeEach(async function () {
            warehouseToken = await ethers.getContract("WarehouseToken", deployer);

            stakeholder1 = (await ethers.getSigners())[1];
            stakeholder2 = (await ethers.getSigners())[2];

            await warehouseToken.transfer(stakeholder1.address, 1000000000);
            await warehouseToken.transfer(stakeholder2.address, 1000000000);

            const stakeholders = [stakeholder1, stakeholder2];

            const re_factory = await ethers.getContractFactory("RealEstate");
            realEstate = await re_factory.deploy(await warehouseToken.getAddress(), 20, 13, stakeholders);

        });

        it("Should correctly deploy the lease contract", async function () {
            assert.equal(await realEstate.token(), await warehouseToken.getAddress());
            assert.equal(await realEstate.tax(), 20);
            assert.equal(await realEstate.avgBlockTime(), 13);
            assert.equal(await realEstate.blocksPer30Day(), Math.floor((60*60*24*30)/13));
        });

        it("Should let gov approve a tenant and pay rent", async function () {
            await realEstate.setRentper30Day(ethers.parseEther("1"));
            
            tenant = (await ethers.getSigners())[4];

            await realEstate.canPayRent(tenant.address);

            await realEstate.connect(tenant).payRent(1, {value: ethers.parseEther("1")});

            const paidUntil = await realEstate.rentpaidUntill(tenant.address);
            assert(paidUntil > 0);
        });

        it("Should distribute revenue according to each stakeholder's share", async function () {
            await realEstate.setRentper30Day(ethers.parseEther("100"));

            tenant = (await ethers.getSigners())[4];

            await realEstate.canPayRent(tenant.address);

            await realEstate.connect(tenant).payRent(1, {value: ethers.parseEther("100")});

            await realEstate.distribute();

            const rev1 = (await realEstate.revenues(stakeholder1.address)).toString()
            const rev2 = (await realEstate.revenues(stakeholder2.address)).toString()

            assert(rev1 > 0);
            assert(rev2 > 0);
        });

        it("Should allow stakeholders to withdraw revenue", async function () {
            await realEstate.setRentper30Day(ethers.parseEther("100"));

            tenant = (await ethers.getSigners())[4];

            await realEstate.canPayRent(tenant.address);

            await realEstate.connect(tenant).payRent(1, { value: ethers.parseEther("100") });

            await realEstate.distribute();

            const balanceBefore = await ethers.provider.getBalance(stakeholder1.address);
            const tx = await realEstate.connect(stakeholder1).withdraw();

            const receipt = await tx.wait();

            const {gasUsed, gasPrice} = receipt;
            const gasCost = gasUsed * gasPrice;

            const balanceAfter = await ethers.provider.getBalance(stakeholder1.address);

            assert(gasCost + balanceAfter > balanceBefore);
        });

        it("SHould allow stakeholder to offer shares", async function() {
            await realEstate.connect(stakeholder1).offerShares(500000000, ethers.parseEther("1000"));
            assert.equal(await realEstate.sharesOffered(stakeholder1.address), 500000000);
        });

        it("Should allow buying shares", async function() {
            await warehouseToken.connect(stakeholder1).approve(await realEstate.getAddress(), 500000000);
            await realEstate.connect(stakeholder1).offerShares(500000000, ethers.parseEther("0.000002"));

            await realEstate.connect(stakeholder2).buyShares(500000000, stakeholder1.address, {value: ethers.parseEther("1000")});

            const stakeholder1Balance = await warehouseToken.balanceOf(stakeholder1.address);
            const stakeholder2Balance = await warehouseToken.balanceOf(stakeholder2.address);

            assert.equal(stakeholder1Balance.toString(), "500000000", "Stakeholder1 should have 500M tokens left");
            assert.equal(stakeholder2Balance.toString(), "1500000000", "Stakeholder2 should have 1.5B tokens");

        });
    });
});