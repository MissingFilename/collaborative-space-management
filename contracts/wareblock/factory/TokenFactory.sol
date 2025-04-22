//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../contracts-master/contracts/WarehouseToken.sol";

library TokenFactory {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint _totalSupply,
        string memory _tokenURI
    ) external returns (address) {
        WarehouseToken wt = new WarehouseToken(_name, _symbol, _totalSupply, _tokenURI);
        return address(wt);
    }
}