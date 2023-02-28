// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IFlashLoanReceiver, ILendingPool, ILendingPoolAddressesProvider} from "./interfaces.sol";

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver{

  ILendingPoolAddressesProvider public immutable override ADDRESSES_PROVIDER;
  ILendingPool public immutable override LENDING_POOL;

  constructor(ILendingPoolAddressesProvider provider) public {
    ADDRESSES_PROVIDER = provider;
    LENDING_POOL = ILendingPool(provider.getLendingPool());
  }
}

contract Arbitrage is FlashLoanReceiverBase{
    IUniswapV2Router02 public immutable sRouter;
    IUniswapV2Router02 public immutable uRouter;
    ILendingPool public immutable lendingPool;

    address public owner;

    constructor(address _sRouter, address _uRouter, address _providerAddress) FlashLoanReceiverBase(_providerAddress) public{
        sRouter = IUniswapV2Router02(_sRouter); //Sushiswap
        uRouter = IUniswapV2Router02(_uRouter); //Uniswap  
        lendingPool = ILendingPool(_providerAddress.getLendingPool());
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner can make the call");
        _;
    }

    function executeTrade(
        bool _startOnUniswap,
        address _token0,
        address _token1,
        uint256 _flashAmount
    ) external onlyOwner {

        uint256 balanceBefore = IERC20(_token0).balanceOf(address(this));

        address receiverAddress = address(this);

        address[] memory assets = new address[](2);
        assets[0] = _token0;
        assets[1] = _token1;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = _flashAmount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0;

        address onBehalfOf = address(this);
        uint16 referralCode = 0;

        bytes memory data = abi.encode(
            _startOnUniswap,
            _token0,
            _token1,
            _flashAmount,
            balanceBefore
        );

        lendingPool.flashLoan(
            receiverAddress,
            assets[0],
            amounts[0],
            modes[0],
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
            bool startOnUniswap,
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

        if (startOnUniswap) {
            _swapOnUniswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnSushiswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount.add(premiums[0]))
            );
        } else {
            _swapOnSushiswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnUniswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount.add(premiums[0]))
            );
        }

        for (uint i = 0; i < assets.length; i++) {
            uint amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }

        IERC20(token0).transfer(
            owner,
            IERC20(token0).balanceOf(address(this)));
        
        return true;
    }

    // -- INTERNAL FUNCTIONS -- //

    function _swapOnUniswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(uRouter), _amountIn),
            "Uniswap approval failed."
        );

        uRouter.swapExactTokensForTokens(
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