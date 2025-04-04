// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Import ERC20 from OpenZeppelin v2 so that Solidity version pragma
// statements are compatible with the crowdsale token
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

// This token contract is the digital representation of the warehouse's
// shares on the Ethereum blockchain.
contract WarehouseToken is ERC20, ERC20Burnable, ERC20Votes, ERC20Permit {
    string public tokenURI;

    address private _owner;
    address crowdsale = address(0);

    constructor(string memory _name, string memory _symbol, uint _totalSupply, string memory _tokenURI) ERC20(_name, _symbol) ERC20Permit(_name){
        tokenURI = _tokenURI;
        _mint(msg.sender, _totalSupply);
        _owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, 'WarehouseToken: Owner-only operation');
        _;
    }

    modifier onlyCrowdsale() {
      require(crowdsale != address(0) && crowdsale == msg.sender, "WarehouseToken: Crowdsale-only operation");
      _;
    }

    function setCrowdsaleAddress(address addr) external onlyOwner {
        require(crowdsale == address(0), "WarehouseToken: Crowdsale address is already set");
        crowdsale = addr;
    }

    // Allow crowdsale to burn without requiring an approve beforehand
    function destroyFrom(address account, uint256 amount) external onlyCrowdsale {
        _approve(account, crowdsale, amount);
        burnFrom(account, amount);
    }

    //override require to use ERC20Votes
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256){
        return super.nonces(owner);
    }
}
