//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./CrowdsaleFactory.sol";
import "./TokenFactory.sol";

contract WarehouseFactory {
    address public daiAddress;
    address public routerAddress;

    constructor(address _daiAddress, address _routerAddress) {
        daiAddress = _daiAddress;
        routerAddress = _routerAddress;
    }

    function createBoth (
        string memory _name, 
        string memory _symbol,
        uint _totalSupply,
        string memory _tokenURI,
        address payable _wallet,
        uint _goal,
        uint _closingTime
    ) external returns (address token, address crowdsale) {
        token = TokenFactory.createToken(_name, _symbol, _totalSupply, _tokenURI);

        uint rate = _totalSupply / _goal;
        crowdsale = CrowdsaleFactory.createCrowdsale(rate, _wallet, token, daiAddress, _goal, _closingTime, routerAddress);

        WarehouseToken(token).setCrowdsaleAddress(crowdsale);
        WarehouseToken(token).transfer(crowdsale, _totalSupply);

        return(token, crowdsale);
    }
}