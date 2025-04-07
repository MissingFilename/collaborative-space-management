// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";

contract WarehouseGovernor is 
    Governor,
    GovernorCountingSimple,
    GovernorVotes
{
    constructor(IVotes _token)
        Governor("WarehouseGovernor")
        GovernorVotes(_token)
    {}

    function votingDelay() public pure override returns (uint256) {
        return 1;
    }

    function votingPeriod() public pure override returns (uint256) {
        return 50;
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 10;
    }

    function quorum(uint256) public pure override returns (uint256) {
        return 40;
    }
}
