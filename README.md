# Collaborative Space Management
This project aims to extend the Wareblock project. We are using two projects discovered during the literature review, __Governor__ and __RealEstate__.

## Description
- __Governor__ will be used to allow _WarehouseToken_ owners to make proposals regarding their property. It is a library provided by __OpenZeppelin__, located at: `@OpenZeppelin/contracts/governance`.
- __RealEstate__ is a university project that will allow the property to be rented. The earnings can then be distributed to the token holders.

## Changes to the original code
1. The __WarehouseToken.sol__ file was altered to inherit _ERC20Votes_. To do so, we need to add _ERC20Votes_ and _ERC20Permit_ to the inherited contracts and two functions have to be overriden as follows:
```solidity
contract WarehouseToken is ERC20, ERC20Burnable, ERC20Votes, ERC20Permit {...}
```

```solidity
    //override require to use ERC20Votes
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256){
        return super.nonces(owner);
    }
```
2. Another change is that in __OpenZeppelin Contracts 5.0__, the _ReentrancyGuard_ contract has been moved to a different location. So we made the following change:

From
```solidity
    import "@openzeppelin/contracts/security/ReentrancyGuard.sol"
```
To
```solidity
    import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"
```

3. Upon compiling the _Wareblock_ contract,  

## Implementation

### Governor Contract
1. We need to modify the __WarehouseToken.sol__ contract to inherit _ERC20Votes_.
2. We have to implement a __WarehouseGovernor.sol__ as explained in <How to setup on-chain governance>. The contract should override all the functions we are to use, in order for the contract to work.
3. The _Timelock_ needs to be implemented in a separate file, __WarehouseTimelock.sol__.

### Real Estate Contract

## Testing

### __/contracts/wareblock/test/__
1. Created a _MockDai_ and a _MockV2RourerV2_ to use for testing.

### __/deploy__
__00-deploy.js__ is used for deploying mocks in case we are using a hardhat network or a local network.

### __/scripts__

### __/test__