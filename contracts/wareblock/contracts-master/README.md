# WareBlock Smart Contracts

This project is using the Hardhat smart contract development framework.

## Setup
Clone repository and install dependencies.

Requires `git`, `npm` and `npx` commands to be available.

```shell
git clone https://gitlab.com/wareblock/contracts
cd contracts
npm install
```

## Hardhat project file structure

+ ⚙️ `hardhat.config.js`: Hardhat's configuration file.
+ 📁 `contracts/`: Solidity smart contracts.
+ 📁 `scripts/`: Contract deployment scripts.
+ 📁 `test/`: Tests against the smart contracts.

## Usage

### Compile contracts
```shell
npx hardhat compile
```

### Run tests
```shell
npx hardhat test
# Or with Ropsten forking (make sure the investor account has DAI on the
# block you choose. See hardhat.config.js for more details)
ALCHEMY_API_KEY="https://eth-ropsten.alchemyapi.io/v2/<your key>" npx hardhat test
```

### Deploy contracts

- To an in-memory instance of Hardhat Network:

  ```shell
  npx hardhat run scripts/deploy.js
  ```

- To a standalone instance of Hardhat Network so that other clients (e.g. MetaMask) may connect to it:

  ```shell
  npx hardhat node # In a separate terminal
  npx hardhat run scripts/deploy.js --network localhost
  ```

### Interact with the contracts in the Hardhat console

```shell
npx hardhat console
```

```js
// >>> Deploy and get instance of contract
// let daiAddress = "0x57ac66399420f7c99f546a5a7c00e0d0ff2679e1" // mainnet
let daiAddress = "0xad6d458402f60fd3bd25163575031acdce07538d" // ropsten
const Wareblock = await ethers.getContractFactory("Wareblock");
const wareblock = await Wareblock.deploy(daiAddress);
await wareblock.deployed();

// >>> Interact
// Call view function
await wareblock.owner()

 // Get first 3 addresses
const [wareblockOwner, crowdsaleBeneficiary, investor] = await ethers.getSigners();
// Send transaction
// For the parameters, see addWarehouse() in ./contracts/Wareblock.sol
const tx = await wareblock.addWarehouse(
  "Regie", // Token name
  "WB0", // Token symbol
  [
    ethers.constants.WeiPerEther.mul(10000),
    ethers.constants.WeiPerEther.mul(20000),
    ethers.constants.WeiPerEther.mul(30000)
  ], // Total supply for each token
  "https://wareblock.com/properties/regie.json", // The HTTP or IPFS link to where property information will be available
  [
    ethers.constants.WeiPerEther.mul(1000),
    ethers.constants.WeiPerEther.mul(2000),
    ethers.constants.WeiPerEther.mul(3000)
  ], // Crowdsale goals in wei: e.g. 1000 * 10^18 wei = 1000 Ether
  crowdsaleBeneficiary.address, // Account which will receive the funds
  24 * 60 * 60 * 90 // Crowdsale duration (90 days)
);
// Wait until the transaction is mined
await tx.wait();

// Get up to date info for all deployed warehouses, their respective tokens
// and crowdsales
await wareblock.getAllWarehouses()
```


