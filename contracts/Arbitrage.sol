// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashLoanReceiver, ILendingPool, ILendingPoolAddressesProvider} from "./interfaces.sol";

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver{

  ILendingPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
  ILendingPool public immutable override LENDING_POOL;

  constructor(ILendingPoolAddressesProvider provider) {
    ADDRESSES_PROVIDER = provider;
    LENDING_POOL = ILendingPool(provider.getLendingPool());
  }
}

contract Arbitrage is FlashLoanReceiverBase{
    IUniswapV2Router02 public immutable sRouter;
    IUniswapV2Router02 public immutable qRouter;
    ILendingPool public immutable lendingPool;

    address public owner;
    address[] private Assets;
    uint256[] private Amounts;

    constructor(address _sRouter, address _qRouter, ILendingPoolAddressesProvider _providerAddress) FlashLoanReceiverBase(_providerAddress) public{
        sRouter = IUniswapV2Router02(_sRouter); //Sushiswap
        qRouter = IUniswapV2Router02(_qRouter); //Uniswap  
        lendingPool = ILendingPool(_providerAddress.getLendingPool());
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner can make the call");
        _;
    }

    function executeTrade(
        bool _startOnQuickswap,
        address _token0,
        address _token1,
        uint256 _flashAmount
    ) external onlyOwner {

        uint256 balanceBefore = IERC20(_token0).balanceOf(address(this));

        address receiverAddress = address(this);

        address[] memory assets = new address[](2);
        assets[0] = _token0;
        Assets[0] = _token0;
        //assets[1] = _token1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _flashAmount;
        Amounts[0] = _flashAmount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        uint16 referralCode = 0;

        bytes memory data = abi.encode(
            _startOnQuickswap,
            _token0,
            _token1,
            _flashAmount,
            balanceBefore
        );

        lendingPool.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            data,
            referralCode
        );
    }

     function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params                                     
    )
        external
        returns (bool)
    {
        (
            bool startOnQuickswap,
            address token0,
            address token1,
            uint256 flashAmount,
            uint256 balanceBefore
        ) = abi.decode(params, (bool, address, address, uint256, uint256));
        
        uint256 balanceAfter = IERC20(token0).balanceOf(address(this));

        require(balanceAfter - balanceBefore == flashAmount, "Contract did not get the loan");
        require(flashAmount == amounts[0], "Flash Amount was not what was requested");

        address[] memory path = new address[](2);

        path[0] = token0;
        path[1] = token1;

        if (startOnQuickswap) {
            _swapOnQuickswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnSushiswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + premiums[0])
            );
        } else {
            _swapOnSushiswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnQuickswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + premiums[0])
            );
        }

        for (uint i = 0; i < 1; i++) {
            uint256 amountOwing = Amounts[i] + premiums[i];
            IERC20(Assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        IERC20(token0).transfer(
            owner,
            IERC20(token0).balanceOf(address(this)));
        
        return true;
    }

    // -- INTERNAL FUNCTIONS -- //

    function _swapOnQuickswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(qRouter), _amountIn),
            "Quickswap approval failed."
        );

        qRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }

    function _swapOnSushiswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(sRouter), _amountIn),
            "Sushiswap approval failed."
        );

        sRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }
}