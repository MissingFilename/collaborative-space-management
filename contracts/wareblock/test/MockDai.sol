// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockDai {
    string public name = "Mock DAI";
    string public symbol = "mDAI";
    uint8 public decimals = 18;
    uint256 constant public totalSupply = 500000000 * 10 ** 18;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor() {
        _balances[msg.sender] = totalSupply;
    }

    function balanceOf(address account) external view returns (uint) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[recipient] += amount;
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(_balances[sender] >= amount, "Insufficient balance");
        require(_allowances[sender][msg.sender] >= amount, "Allowance exceeded");

        _balances[sender] -= amount;
        _balances[recipient] += amount;
        _allowances[sender][msg.sender] -= amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    // Optional: getter for allowance
    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }
}
