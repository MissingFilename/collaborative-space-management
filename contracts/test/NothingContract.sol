//SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract NothingContract {
    uint256 private value;

    constructor () {
        value = 0;
    }

    function setValue (uint256 _value) public {
        value = _value;
    }

    function getValue () public view returns (uint256) {
        return value;
    }
}