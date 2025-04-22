# Collaborative Space Management
This project aims to extend the Wareblock project. We are using two projects discovered during the literature review, __Governor__ and __RealEstate__.

## Description
- __Governor__ will be used to allow _WarehouseToken_ owners to make proposals regarding their property. It is a library provided by __OpenZeppelin__, located at: `@OpenZeppelin/contracts/governance`.
- __RealEstate__ is a university project that will allow the property to be rented. The earnings can then be distributed to the token holders.

## Instructions

This project was implemented with the use of `yarn`.

To run the project use:

1. Make sure you are in the root directory of the project:
```console
    cd collaborative-space-management
```

2. To install dependencies use:
```console
    yarn install
```

3. A `.env` file was used to provide with a __SEPOLIA_RPC_URL__ and a __PRIVATE_KEY__. By default we have git ignore the `.env`. Before using the contracts. The following should be present in a `.env` file in the project directory, for the project to run:
```
    SEPOLIA_RPC_URL=<Your Sepolia rpc url goes here>
    PRIVATE_KEY=<Yout private key wallet>
```
These variables are pulled from the `.env` in the `helper-hardhat-config.js`. 

4. To compile the project files use:
```console
    yarn hardhat compile
```

5. To run the unit tests use:
```console
    yarn hardhat test
```
By default the Hardhat test network is used but in the event that this is untrue use the following to ensure the hardhat network is used:
```console
    yarn hardhat test --network hardhat
```

To use the hardhat node that is provided by Hardhat, use the following:
```console
    yarn hardhat test --network localhost
```
In this case you might need to edit the `hardhat.config.js` file to inlcude the correct local IP address in which the node is hosted.

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

3. Gas cost and Bytecode size improvements:
Upon compiling the _Wareblock_ contract we received an error, that the contract bytecode is too large to deploy (twice the limit, which is ~25kB). So we had to make some changes to imporove contract size and gas costs.

All `require` statements have been transformed to
```solidity
    if(<statement>) revert Custom_error();
```
This is because the `string` parameter in `require` statements is too inefficient to store. Allthough this did not have much of an effect.

By some experimenting, we discovered that the _Wareblock_ contract contains a large number of contract deployments which have a great toll, both in bytecode size and in gas costs. So we use a contract factory. Also the two factories (one for the _WarehouseCrowdsale_ and one for the _WarehouseToken_) are libraries and not contracts. This means that they are compiled and deployed independantly which greatly improves the Bytecode size. 

## Implementation

### Governor Contract
1. We need to modify the __WarehouseToken.sol__ contract to inherit _ERC20Votes_.
2. We have to implement a __WarehouseGovernor.sol__ as explained in <How to setup on-chain governance>. The contract should override all the functions we are to use, in order for the contract to work.
3. The _Timelock_ needs to be implemented in a separate file, __WarehouseTimelock.sol__.

### Real Estate Contract
1. One of the bigger changes in the _realEstate_ contract is the removal of shares and addition of a _WarehouseToken_.
2. The constructor needs to be modified. On contract creation, stakeholders would already have bought their share, so we will use the constructor to add them to the real estate contract.
3. We also had to remove the main property owner since we dont need a clear owner. So the mainPropertyOwner functions will be handled by the property manager.

## Testing
Many of the tests to the original projects have been made by their respected authors, so we only test the changes we made.

### __/contracts/wareblock/test/__
1. Created a _MockDai_ and a _MockV2RourerV2_ to use for testing on a local network.

### __/deploy__
_Description:_ Contains the code for contract deployment.

1. __00-deploy.js__ is used for deploying mocks in case we are using a hardhat network or a local network.
2. __01-deploy.js__ is used to deploy the two libraries used in the _Wareblock_ contract and then the contract itself.
3. __02-deploy.js__ is a deploy script for a _WarehouseToken_ and a _WarehouseGovernor_ contract.

### __/scripts__
_Description:_ Contains the extra code we might want to run.

#### __WarehouseGovernor.js__
Deploys a _WarehouseToken_ contract instance and the _WarehouseGovernor_. Creates a proposal, has two accounts vote on the proposal and proposal fails.

#### __RealEstate.js__
Deploys a _WarehouseToken_ contract instance and the _RealEstate_ contract.

### __/test__
_Description:_ Contains the tests we are to perform.

#### Unit tests
_Description:_ The tests we are going to perform locally, bit-by-bit to see if parts work.

The included unit tests

#### Staging tests
_Description:_ The tests we are going to perform on a testnet.