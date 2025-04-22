//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../contracts-master/contracts/WarehouseCrowdsale.sol";


library CrowdsaleFactory {
    function createCrowdsale(
        uint _rate, 
        address payable _wallet, 
        address _token,
        address _daiAddress,
        uint _goal,
        uint _closingTime,
        address _routerAddress
    ) external returns (address) {
        WarehouseCrowdsale wc = new WarehouseCrowdsale (_rate, _wallet, WarehouseToken(_token), _daiAddress, _goal, _closingTime, _routerAddress);
        return address(wc);
    }
}