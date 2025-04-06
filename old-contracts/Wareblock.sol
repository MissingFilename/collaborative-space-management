// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./WarehouseToken.sol";
import "./WarehouseCrowdsale.sol";

// Main contract
// This is the contract factory which manages all Warehouse tokens
contract Wareblock {
  address public owner;
  // The address of the token to which incoming Ether is automatically
  // converted to through a decentralized exchange (dex)
  // It may be any ERC20 token, preferrably a stablecoin.
  // Our platform uses DAI.
  address public daiAddress;

  address public routerAddress;
  // Note: Depending on whether the master contract will further manage
  // warehouse tokens/crowdsales after they are created, it might not be
  // necessary to store the addresses at all, since we may retrieve them
  // through the WarehouseAdded contract events.
  struct Warehouse {
    address[] warehouseTokens;
    address payable[] warehouseCrowdsales;
  }
  Warehouse[] private warehouses;

  // Frontend: This struct will be used as an aggregator of information
  // about a warehouse and its token and crowdsale contracts.
  // It offers convenient querying of information through the
  // getAllWarehouses() method.
  struct WarehouseInfo {
    string name;
    string symbol;
    string tokenURI;
    uint closingTime;
    WarehouseLandUseInfo[] uses;
  }

  struct WarehouseLandUseInfo {
      address warehouseToken;
      address payable warehouseCrowdsale;
      uint totalSupply;
      uint goal;
      uint daiRaised;
      uint supplyforSale;
      uint rate;
  }

  event WarehouseAdded(address[] warehouseTokenAddresses, address payable[] warehouseCrowdsaleAddresses);

  constructor(address _daiAddress, address _routerAddress) {
    owner = msg.sender;
    daiAddress = _daiAddress;
    routerAddress = _routerAddress;
  }

  modifier onlyOwner() {
    require(owner == msg.sender, "You are not the owner of the Wareblock contract");
    _;
  }

  // Deploy a new WarehouseToken and WarehouseCrowdsale for each land use and
  // store their address in the warehouses array
  function addWarehouse(
    string memory _name,
    string memory _symbol,
    uint[] memory _totalSupplies, // TODO: These could be constant. Rate can be computed based on goal
    string memory _tokenURI,
    uint[] memory _goals, // In general we expect 2-3 goals
    address payable _wallet,
    uint _duration
  ) public onlyOwner {
    require(_totalSupplies.length == _goals.length, "The number of total supplies does not match the number of goals");
    address payable[] memory crowdsales = new address payable[](_goals.length);
    address[] memory tokens = new address [](_goals.length);
    for (uint i = 0; i < _goals.length; i++) {
        require(_totalSupplies[i] % _goals[i] == 0, "Total supply is not divisible by goal");
        WarehouseToken wt = new WarehouseToken(_name, _symbol, _totalSupplies[i], _tokenURI);
        WarehouseCrowdsale wc = new WarehouseCrowdsale(_totalSupplies[i] / _goals[i], _wallet, wt, daiAddress, _goals[i], block.timestamp + _duration, routerAddress);
        wt.setCrowdsaleAddress(address(wc));
        crowdsales[i] = payable(wc);
        tokens[i] = address(wt);

        // Give the total (minted) supply to the WarehouseCrowdsale
        // contract so that it may sell it to investors
        wt.transfer(address(wc), _totalSupplies[i]);
    }

    Warehouse memory warehouse;
    warehouse.warehouseTokens = tokens;
    warehouse.warehouseCrowdsales = crowdsales;
    warehouses.push(warehouse);
    emit WarehouseAdded(tokens, crowdsales);

    // Set siblings if needed
    if (_goals.length == 1) {
        return;
    }
    for (uint i = 0; i < crowdsales.length; i++) {
        WarehouseCrowdsale(crowdsales[i]).setSiblings(crowdsales);
    }
  }

  function getWarehouse(uint256 i) public view returns (Warehouse memory) {
      return warehouses[i];
  }

  // Front-end helper: Returns an array of all warehouses and up to date
  // information about their token and crowdsale status.
  // Note: We could save gas during contract deployment by removing this
  // function
  function getAllWarehouses() public view returns (WarehouseInfo[] memory) {
    WarehouseInfo[] memory warehouseInfoArray = new WarehouseInfo[](warehouses.length);
    for (uint i = 0; i < warehouses.length; i++) {
      WarehouseInfo memory wi;
      WarehouseLandUseInfo[] memory warehouseLandUseInfoArray = new WarehouseLandUseInfo[](warehouses[i].warehouseTokens.length);
      WarehouseToken wt;
      WarehouseCrowdsale wc;
      for (uint j = 0; j < warehouses[i].warehouseTokens.length; j++) {
        WarehouseLandUseInfo memory landUse;

        landUse.warehouseToken = warehouses[i].warehouseTokens[j];
        landUse.warehouseCrowdsale = warehouses[i].warehouseCrowdsales[j];

        wt = WarehouseToken(landUse.warehouseToken);
        wc = WarehouseCrowdsale(landUse.warehouseCrowdsale);

        landUse.totalSupply = wt.totalSupply();
        landUse.goal = wc.goal();
        landUse.daiRaised = wc.daiRaised();
        landUse.supplyforSale = wt.balanceOf(landUse.warehouseCrowdsale);
        landUse.rate = wc.rate();

        warehouseLandUseInfoArray[j] = landUse;
      }

      // Some info is constant and remains the same for all tokens/crowdsales
      // so just get it from the first land use
      wt = WarehouseToken(warehouses[i].warehouseTokens[0]);
      wc = WarehouseCrowdsale(warehouses[i].warehouseCrowdsales[0]);
      wi.name = wt.name();
      wi.symbol = wt.symbol();
      wi.tokenURI = wt.tokenURI();
      wi.closingTime = wc.closingTime();

      wi.uses = warehouseLandUseInfoArray;
      warehouseInfoArray[i] = wi;
    }
    return warehouseInfoArray;
  }

}
