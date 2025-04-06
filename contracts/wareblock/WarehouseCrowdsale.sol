// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// This contract was adapted from OpenZeppelin's Crowdsale, TimedCrowdsale,
// RefundableCrowdsale, Escrow, ConditionalEscrow and RefundEscrow found in
// version 2 OpenZeppelin's contracts library.
// We need to adapt the original contracts instead of extending them for the
// following reasons:
// 1. We need to convert to Ether to DAI when tokens are purchased, refund
//    DAI instead of Ether, and keep `daiRaised()` up to date.
// 2. Since we are dealing with DAI instead of Ether, we do not need an
//    escrow, but we still need escrow functionality to be implemented in the
//    crowdsale itself.
// 3. We need a custom rules for buying and refunding tokens to allow for
//    multiple different goals.
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./WarehouseToken.sol";
import "./DaiSwapping.sol";

error WarehouseCrowdsale_non_zero_rate();
error WarehouseCrowdsale_wallet_zero_address();
error WarehouseCrowdsale_token_zero_address();
error WarehouseCrowdsale_zero_goal();
error WarehouseCrowdsale_opening_time_after_closing();
error WarehouseCrowdsale_not_owner();
error WarehouseCrowdsale_warehouse_not_open();
error WarehouseCrowdsale_different_goal_reached();
error WarehouseCrowdsale_beneficiary_zero_address();
error WarehouseCrowdsale_wei_is_zero();
error WarehouseCrowdsale_requested_wei_not_equal_received();
error WarehouseCrowdsale_goal_exceeded();
error WarehouseCrowdsale_cannot_send_leftover_eth();
error WarehouseCrowdsale_dai_transfer_failed();
error WarehouseCrowdsale_not_open();
error WarehouseCrowdsale_dai_is_zero();
error WarehouseCrowdsale_refund_not_allowed();
error WarehouseCrowdsale_goal_not_reached();

contract WarehouseCrowdsale is Context, ReentrancyGuard {
    using SafeERC20 for WarehouseToken;

    // The token being sold
    WarehouseToken private _token;

    // Crowdsales referring to the same property but different land use
    address[] private _siblings;

    // Address where funds are collected
    address payable private _wallet;

    address private _owner;

    // How many token units a buyer gets per dai unit.
    // The rate is the conversion between dai and the smallest and indivisible
    // token unit. So, if you are using a rate of 1 with a ERC20 token
    // with 3 decimals called TOK, 1 dai unit will give you 1 token unit, or
    // 0.001 TOK.
    uint256 private _rate;

    // Timestamps for when the crowdsale opens and closes.
    // Tokens may not be bought after _closingTime.
    uint256 private _openingTime;
    uint256 private _closingTime;

    // minimum amount of funds to be raised in dai
    uint256 private _goal;

    // How much DAI each account has deposited
    mapping(address => uint256) private _deposits;

    // Instance of DAI token
    Dai dai;
    // Instance of Uniswap router
    // It has been deployed on this address on ALL public networks
    UniswapV2Router02 uniswapRouter;

    // Amount of DAI raised
    uint256 private _daiRaised;

    /**
     * Event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param daiAmount dai paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 daiAmount, uint256 amount);

    /**
     * @dev Constructor, checks parameters, initializes storage and  DAI instance.
     * @param __rate Number of token units a buyer gets per dai unit
     * @dev The rate is the conversion between a dai unit and the smallest and indivisible
     * token unit. So, if you are using a rate of 1 with a ERC20 token
     * with 3 decimals called TOK, 1 dai unit will give you 1 token unit, or 0.001 TOK.
     * @param __wallet Address where collected funds will be forwarded to
     * @param __token Address of the token being sold
     * @param __goal Funding goal
     */
    constructor (
        uint256 __rate,
        address payable __wallet,
        WarehouseToken __token,
        address daiAddress,
        uint __goal,
        uint __closingTime,
        address routerAddress
    ) {
        if(!(__rate > 0)) revert WarehouseCrowdsale_non_zero_rate();
        if(__wallet == address(0)) revert WarehouseCrowdsale_wallet_zero_address();
        if(address(__token) == address(0)) revert WarehouseCrowdsale_token_zero_address();
        if(!(__goal > 0)) revert WarehouseCrowdsale_zero_goal();
        if(!(__closingTime > block.timestamp)) revert WarehouseCrowdsale_opening_time_after_closing();
        
        _rate = __rate;
        _wallet = __wallet;
        _token = __token;
        _openingTime = block.timestamp;
        _closingTime = __closingTime;
        _goal = __goal;
        dai = Dai(daiAddress);
        uniswapRouter = UniswapV2Router02(routerAddress);

        _owner = msg.sender;
    }

    modifier onlyOwner() {
        if(msg.sender != _owner) revert WarehouseCrowdsale_not_owner();
        _;
    }

    function setSiblings(address payable[] memory crowdsales) external onlyOwner {
        // Add all except self to siblings
        for (uint i = 0; i < crowdsales.length; i++) {
          if (crowdsales[i] == address(this)) {
            continue;
          }
          _siblings.push(crowdsales[i]);
        }
    }

    /**
     * @dev fallback function ***DO NOT OVERRIDE***
     * Note that other contracts will transfer funds with a base gas stipend
     * of 2300, which is not enough to call buyTokens. Consider calling
     * buyTokens directly when purchasing tokens from a contract.
     */
    receive() external payable {
        // TODO: (optional) get expected rate from on-chain oracle and use it
        // to calculate the minimum amount of tokens to be passed to buyTokens
        // buyTokens(_msgSender(), <minimum expected amount>);
    }

    /**
     * @return the token being sold.
     */
    function token() public view returns (IERC20) {
        return _token;
    }

    /**
     * @return the address which may withdraw the funds after the crowdsale
     * reaches its goal.
     */
    function wallet() public view returns (address payable) {
        return _wallet;
    }

    /**
     * @return the number of token units a buyer gets per dai unit.
     */
    function rate() public view returns (uint256) {
        return _rate;
    }

    /**
     * @return the crowdsale opening time.
     */
    function openingTime() public view returns (uint256) {
        return _openingTime;
    }

    /**
     * @return the crowdsale closing time.
     */
    function closingTime() public view returns (uint256) {
        return _closingTime;
    }

    /**
     * @return true if the crowdsale is open, false otherwise.
     */
    function isOpen() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp >= _openingTime && block.timestamp <= _closingTime;
    }

    /**
     * @dev Checks whether the period in which the crowdsale is open has already elapsed.
     * @return Whether crowdsale period has elapsed
     */
    function hasClosed() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp > _closingTime;
    }

    /**
     * @return Whether any one of the sibling crowdsales (excluding self) has reached its goal
     */
    function siblingGoalReached() public view returns (bool) {
        for (uint i = 0; i < _siblings.length; i++) {
            if (WarehouseCrowdsale(payable(_siblings[i])).goalReached()) {
                return true;
            }
        }
        return false;
    }

    /**
     * @return the amount of DAI raised.
     */
    function daiRaised() public view returns (uint256) {
        return _daiRaised;
    }

    /**
     * @return minimum amount of funds to be raised in DAI.
     */
    function goal() public view returns (uint256) {
        return _goal;
    }

    /**
     * @dev low level token purchase ***DO NOT OVERRIDE***
     * This function has a non-reentrancy guard, so it shouldn't be called by
     * another `nonReentrant` function.
     * @param beneficiary Recipient of the token purchase
     * @param daiAmountOut Amount of DAI that must be received for the transaction not to revert.
     * @param deadline Unix timestamp after which the transaction will revert. See:
     * https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02#swapethforexacttokens
     * @dev msg.value (amountInMax) The maximum amount of ETH that can be
     * required before the transaction reverts. Leftover ETH, if any, is
     * returned to msg.sender
     */
    function buyTokens(address beneficiary, uint256 daiAmountOut, uint256 deadline) public nonReentrant payable {
        // We manually do part of _preValidatePurchase() here since we can only
        // check daiAmount after the swap has happened.
        if(!isOpen()) revert WarehouseCrowdsale_warehouse_not_open();
        if (_siblings.length > 0) {
            if(siblingGoalReached()) revert WarehouseCrowdsale_different_goal_reached();
        }
        if(beneficiary == address(0)) revert WarehouseCrowdsale_beneficiary_zero_address();
        uint256 weiAmount = msg.value;
        if(weiAmount == 0) revert WarehouseCrowdsale_wei_is_zero();

        // Convert received Ether to DAI
        // https://docs.uniswap.org/protocol/V2/reference/smart-contracts/router-02#swapexactethfortokens
        address[] memory path = new address[](2);
        path[0] = uniswapRouter.WETH();
        path[1] = address(dai);

        uint[] memory amounts = uniswapRouter.swapETHForExactTokens{value: weiAmount}(
            daiAmountOut,
            path,
            address(this),
            deadline
        );
        uint256 daiAmount = amounts[1];
        if(daiAmount != daiAmountOut) revert WarehouseCrowdsale_requested_wei_not_equal_received();

        // calculate token amount to be created
        uint256 tokens = _getTokenAmount(daiAmount);

        // Update state and check _daiRaised (since we do not use
        // _preValidatePurchase() in this method)
        _daiRaised = _daiRaised + daiAmount;
        if(!(_daiRaised <= _goal)) revert WarehouseCrowdsale_goal_exceeded();

        _processPurchase(beneficiary, tokens, daiAmount);

        // Return leftover Ether to msg.sender
        // amounts[0] is the actual Eth amount that was used for the swap
        uint leftoverEth = msg.value - amounts[0];
        if (leftoverEth != 0) {
            if(!payable(_msgSender()).send(leftoverEth)) revert WarehouseCrowdsale_cannot_send_leftover_eth();
        }

        emit TokensPurchased(_msgSender(), beneficiary, daiAmount, tokens);
    }

    // Transfers daiAmount of DAI from msg.sender to the contract
    // NOTE: msg.sender needs to send an ERC20 `approve` transaction for at
    // least `daiAmount` DAI prior to `buyTokensWithDai()`in order for this
    // transfer to succeed
    function buyTokensWithDai(address beneficiary, uint256 daiAmount) public nonReentrant {
        _preValidatePurchase(beneficiary, daiAmount);

        // Transfer DAI
        if (!(dai.transferFrom(_msgSender(), address(this), daiAmount))) revert WarehouseCrowdsale_dai_transfer_failed();

        // Calculate token amount to be created
        uint256 tokens = _getTokenAmount(daiAmount);

        // Update state
        _daiRaised = _daiRaised + daiAmount;

        _processPurchase(beneficiary, tokens, daiAmount);
        emit TokensPurchased(_msgSender(), beneficiary, daiAmount, tokens);
    }

    /**
     * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met.
     * Use `super` in contracts that inherit from Crowdsale to extend their validations.
     * @param beneficiary Address performing the token purchase
     * @param daiAmount Value in DAI involved in the purchase
     */
    function _preValidatePurchase(address beneficiary, uint256 daiAmount) internal view {
        if(!isOpen()) revert WarehouseCrowdsale_not_open();
        if (_siblings.length > 0) {
            if(siblingGoalReached()) revert WarehouseCrowdsale_different_goal_reached();
        }
        if(beneficiary == address(0)) revert WarehouseCrowdsale_beneficiary_zero_address();
        if(daiAmount == 0) revert WarehouseCrowdsale_dai_is_zero();
        if(!(daiRaised() + daiAmount <= _goal)) revert WarehouseCrowdsale_goal_exceeded();
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
    }

    /**
     * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends
     * its tokens.
     * @param beneficiary Address performing the token purchase
     * @param tokenAmount Number of tokens to be emitted
     */
    function _deliverTokens(address beneficiary, uint256 tokenAmount) internal {
        _token.safeTransfer(beneficiary, tokenAmount);
    }

    /**
     * @dev Executed when a purchase has been validated and is ready to be executed. Doesn't necessarily emit/send
     * tokens.
     * @param beneficiary Address receiving the tokens
     * @param tokenAmount Number of tokens to be purchased
     * @param daiAmount dai paid for purchase
     */
    function _processPurchase(address beneficiary, uint256 tokenAmount, uint256 daiAmount) internal {
        _deliverTokens(beneficiary, tokenAmount);
        _deposits[beneficiary] = _deposits[beneficiary] + daiAmount;
    }

    /**
     * @dev Override to extend the way in which dai is converted to tokens.
     * @param daiAmount Value in DAI to be converted into tokens
     * @return Number of tokens that can be purchased with the specified _weiAmount
     */
    function _getTokenAmount(uint256 daiAmount) internal view returns (uint256) {
        return daiAmount * _rate;
    }

    /**
     * @dev Checks whether funding goal was reached.
     * @return Whether funding goal was reached
     */
    function goalReached() public view returns (bool) {
        return daiRaised() >= _goal;
    }

    // >>> Withdrawing funds and refunding investments
    // We adapt OpenZeppelin's Escrow, ConditionalEscrow and RefundEscrow
    // functionality here since we now have to deal with a token instead of
    // Ether, thus we do not need a separate contract to handle it.

    function depositsOf(address payee) public view returns (uint256) {
        return _deposits[payee];
    }

    /**
     * @dev Returns whether refundees can withdraw their deposits (be refunded). The overridden function receives a
     * 'payee' argument, but we ignore it here since the condition is global, not per-payee.
     */
    function refundAllowed(address) public view returns (bool) {
        return (hasClosed() && !goalReached()) || (_siblings.length > 0 && siblingGoalReached());
    }

    /**
     * @dev Investors can claim refunds here if crowdsale is unsuccessful.
     * Note: This is a modified version of claimRefund() which burns the
     *       payee's tokens and returns DAI instead of ETH.
     */

    function claimRefund() public {
        address payee = _msgSender();
        if(!refundAllowed(payee)) revert WarehouseCrowdsale_refund_not_allowed();

        // Burn tokens using destroyFrom() implemented in WarehouseToken
        _token.destroyFrom(payee, _token.balanceOf(payee));

        // Return DAI to investor
        uint256 refundAmount = _deposits[payee];
        _deposits[payee] = 0;
        dai.transfer(payee, refundAmount);
    }

    /**
     * @dev Sends accumulated funds to the crowdsale beneficiary (_wallet).
     */
    function beneficiaryWithdraw() public {
        if(!goalReached()) revert WarehouseCrowdsale_goal_not_reached();
        dai.transfer(_wallet, dai.balanceOf(address(this)));
    }

    /**
     * @dev Increments refundee's deposit
     * @param refundee The address funds will be sent to if a refund occurs.
     */
    function updateDeposit(address refundee, uint256 daiAmount) internal {
        _deposits[refundee] = _deposits[refundee] + daiAmount;
    }

}
