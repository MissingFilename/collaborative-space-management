// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
// Interfaces required in order to swap DAI to Ether and Ether to DAI
// through the Uniswap decentralized exchange.

// Methods we will need from the Dai (ERC20) token
interface Dai {
    function balanceOf(address account) external view returns (uint);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

// Deployed on 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D on all public
// networks
interface UniswapV2Router02 {
  function WETH() external returns (address);

  // Many Uniswap functions include a transaction deadline that sets a time
  // after which a transaction can no longer be executed. This limits miners
  // holding signed transactions for extended durations and executing them
  // based off market movements. It also reduces uncertainty around
  // transactions that take a long time to execute due to issues with gas
  // price.
  // (Source: https://ethereum.stackexchange.com/a/83798)

  function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline
  ) external returns (uint[] memory amounts);

  function swapTokensForExactTokens(
    uint amountOut,
    uint amountInMax,
    address[] calldata path,
    address to,
    uint deadline
  ) external returns (uint[] memory amounts);

  function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline)
  external
  payable
  returns (uint[] memory amounts);

  // function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline)
  // external
  // returns (uint[] memory amounts);

  function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)
  external
  returns (uint[] memory amounts);

  function swapETHForExactTokens(
    uint amountOut,
    address[] calldata path,
    address to,
    uint deadline
    ) external payable returns (uint[] memory amounts);
}
