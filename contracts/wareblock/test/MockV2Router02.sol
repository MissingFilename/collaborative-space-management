// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../DaiSwapping.sol";

contract MockV2Router02 {
    address public immutable WETH_ADDRESS;

    constructor(address _weth) {
        WETH_ADDRESS = _weth;
    }

    function WETH() external view returns (address) {
        return WETH_ADDRESS;
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path.length >= 2, "Invalid path");

        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        require(
            Dai(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "TransferFrom failed"
        );

        uint amountOut = amountIn;
        require(amountOut >= amountOutMin, "Slippage check failed");

        require(
            Dai(tokenOut).transfer(to, amountOut),
            "Transfer to recipient failed"
        );

        amounts = new uint[](path.length);
        for (uint i = 0; i < path.length; i++) {
            amounts[i] = amountOut;
        }

        return amounts;
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path.length >= 2, "Invalid path");

        address tokenIn = path[0];
        address tokenOut = path[path.length - 1];

        // For mock: assume 1:1 rate
        require(amountOut <= amountInMax, "Too much input required");

        require(
            Dai(tokenIn).transferFrom(msg.sender, address(this), amountOut),
            "TransferFrom failed"
        );

        require(
            Dai(tokenOut).transfer(to, amountOut),
            "Transfer to recipient failed"
        );

        amounts = new uint[](path.length);
        for (uint i = 0; i < path.length; i++) {
            amounts[i] = amountOut;
        }

        return amounts;
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path[0] == WETH_ADDRESS, "First token must be WETH");

        uint amountOut = msg.value; // mock 1:1 rate

        require(amountOut >= amountOutMin, "Slippage check failed");

        address tokenOut = path[path.length - 1];
        require(
            Dai(tokenOut).transfer(to, amountOut),
            "Transfer to recipient failed"
        );

        amounts = new uint[](path.length);
        for (uint i = 0; i < path.length; i++) {
            amounts[i] = amountOut;
        }

        return amounts;
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path[path.length - 1] == WETH_ADDRESS, "Last token must be WETH");

        address tokenIn = path[0];

        require(
            Dai(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "TransferFrom failed"
        );

        uint amountOut = amountIn;
        require(amountOut >= amountOutMin, "Slippage check failed");

        payable(to).transfer(amountOut); // mock: sending ETH

        amounts = new uint[](path.length);
        for (uint i = 0; i < path.length; i++) {
            amounts[i] = amountOut;
        }

        return amounts;
    }

    function swapETHForExactTokens(
        uint amountOut,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(path[0] == WETH_ADDRESS, "First token must be WETH");
        require(msg.value >= amountOut, "Not enough ETH sent");

        address tokenOut = path[path.length - 1];

        require(
            Dai(tokenOut).transfer(to, amountOut),
            "Transfer to recipient failed"
        );

        // Return excess ETH
        uint refund = msg.value - amountOut;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }

        amounts = new uint[](path.length);
        for (uint i = 0; i < path.length; i++) {
            amounts[i] = amountOut;
        }

        return amounts;
    }

    // Fallback to receive ETH when testing
    receive() external payable {}
}
