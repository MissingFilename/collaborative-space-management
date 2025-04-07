const { getNamedAccounts, ethers, network, deployments } = require("hardhat");

async function main() {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const signers = await ethers.getSigners();
    const tokenOwner = signers[0];

    console.log("Deploying WarehouseToken...");
    const WarehouseToken = await deploy("WarehouseToken", {
        from: deployer,
        log: true,
        args: ["Apothiki", "APO", 1000, ""],
    });

    console.log("Deploying WarehouseGovernor...");
    const WarehouseGovernor = await deploy("WarehouseGovernor", {
        from: deployer,
        log: true,
        args: [WarehouseToken.address],
    });

    const token = await ethers.getContract("WarehouseToken", deployer);
    const governor = await ethers.getContract("WarehouseGovernor", deployer);

    // Transfer tokens to voters
    await (await token.transfer(signers[1].address, 100)).wait();
    await (await token.transfer(signers[2].address, 100)).wait();

    // Delegate voting power
    await token.delegate(deployer);
    await token.connect(signers[1]).delegate(signers[1].address);
    await token.connect(signers[2]).delegate(signers[2].address);

    // Create proposal
    const calldata = token.interface.encodeFunctionData("setCrowdsaleAddress", [
        "0x0000000000000000000000000000000000000001"
    ]);

    const proposalTx = await governor.propose(
        [token.target],
        [0],
        [calldata],
        "This is the first proposal"
    );

    const receipt = await proposalTx.wait();
    const events = await governor.queryFilter("ProposalCreated", receipt.blockNumber);
    const proposalId = events[0].args.proposalId;
    console.log("Proposal created:", proposalId.toString());

    // Get voting delay and mine blocks to reach voting period
    const votingDelay = await governor.votingDelay();
    console.log(`Voting delay: ${votingDelay} blocks`);

    for (let i = 0; i < Number(votingDelay); i++) {
        await ethers.provider.send("evm_mine", []);
    }

    // Check proposal state before voting
    const stateBeforeVoting = await governor.state(proposalId);
    console.log("Proposal state before voting:", stateBeforeVoting);

    // Cast votes
    await governor.castVote(proposalId, 1); // 1 = For
    const voter1 = governor.connect(signers[1]);
    const voter2 = governor.connect(signers[2]);
    await voter1.castVote(proposalId, 0); // Against
    await voter2.castVote(proposalId, 1); // For

    console.log("Voting in progress...");

    // Get voting period and mine enough blocks to end voting
    const votingPeriod = await governor.votingPeriod();
    console.log(`Voting period: ${votingPeriod} blocks`);

    for (let i = 0; i < Number(votingPeriod); i++) {
        await ethers.provider.send("evm_mine", []);
    }

    console.log("Voting period ended.");

    // Check state after voting
    const stateAfterVoting = await governor.state(proposalId);
    console.log("Proposal state after voting:", stateAfterVoting);

    // Queue proposal if succeeded
    if (stateAfterVoting === 4) { // 4 typically means Succeeded
        console.log("Queueing proposal...");
        await governor.queue(
            [token.target],
            [0],
            [calldata],
            ethers.id("This is the first proposal")
        );

        // Check if there's a delay before execution
        const delay = await governor.delay ? await governor.delay() : 0;
        console.log(`Execution delay: ${delay}`);

        for (let i = 0; i < Number(delay); i++) {
            await ethers.provider.send("evm_mine", []);
        }

        // Execute proposal
        console.log("Executing proposal...");
        await governor.execute(
            [token.target],
            [0],
            [calldata],
            ethers.id("This is the first proposal")
        );

        console.log("Proposal executed!");
    } else {
        console.log("Proposal did not succeed. State:", stateAfterVoting);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});