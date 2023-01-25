require('./helpers/server')
require("dotenv").config();

const ethers = require("ethers")
const config = require('./config.json')
const { calculateDifference } = require('./helpers/helpers')
const { getTokenAndContract, getPairContract, getReserves, calculatePrice, simulate } = require('./helpers/helpers')
const { provider, uFactory, uRouter, sFactory, sRouter, arbitrage } = require('./helpers/initialization')

const arbFor = process.env.ARB_FOR; //WETH
const arbAgainst = process.env.ARB_AGAINST; //SHIB
const units = process.env.UNITS;
const difference = process.env.PRICE_DIFFERENCE;
const gasLimit = process.env.GAS_LIMIT;
const gasPrice = process.env.GAS_PRICE;

let uPair, sPair, amount;
let isExecuting = false;

const main = async () => {
    const { token0Contract, token1Contract, token0, token1 } = await getTokenAndContract(arbFor, arbAgainst, provider);
    uPair = await getPairContract(uFactory, token0.address, token1.address, provider);
    sPair = await getPairContract(sFactory, token0.address, token1.address, provider);

    console.log(`uPair Address: ${uPair.address}`);
    console.log(`sPair Address: ${sPair.address}\n`);

    uPair.on('Swap', async () => {
        if(!isExecuting){
            isExecuting = true
            
            const priceDifference = await checkPrice('Uniswap', token0, token1);
            const routerPath = await determineDirection(priceDifference);

            if(!routerPath) {
                console.log(`No Arbitrage Currently Available\n`);
                console.log(`-------------------------------------------\n`);
                isExecuting = false;
                return
            }

            const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1);

            if(!isProfitable){
                console.log(`No Arbitrage Currently Available\n`);
                console.log(`------------------------------------------------------\n`);
                isExecuting = false;
                return;
            }

            const receipt = await executeTrade(routerPath, token0Contract, token1Contract);

            isExecuting = false;
        }
    });

    sPair.on('Swap', async () => {
        if(!isExecuting){
            isExecuting = true
            
            const priceDifference = await checkPrice('Sushiswap', token0, token1);
            const routerPath = await determineDirection(priceDifference);

            if(!routerPath) {
                console.log(`No Arbitrage Currently Available\n`);
                console.log(`-------------------------------------------\n`);
                isExecuting = false;
                return
            }

            const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1);

            if(!isProfitable){
                console.log(`No Arbitrage Currently Available\n`);
                console.log(`------------------------------------------------------\n`);
                isExecuting = false;
                return;
            }

            const receipt = await executeTrade(routerPath, token0Contract, token1Contract);

            isExecuting = false;
        }
    });

    console.log("Waiting for swap event...");
}

const checkPrice = async (exchange, token0, token1) => {
    isExecuting = true;

    console.log(`Swap Initiated on ${exchange}, Checking Price ....\n`);

    const currentBlock = await provider.getBlockNumber();

    const uPrice = await calculatePrice(uPair);
    const sPrice = await calculatePrice(sPair);

    const uFPrice = Number(uPrice).toFixed(units);
    const sFPrice = Number(sPrice).toFixed(units);

    const priceDifference = calculateDifference(uFPrice, sFPrice);

    console.log(`Current Block: ${currentBlock}`);
    console.log('------------------------------------');
    console.log(`UNISWAP     | ${token1.symbol}/${token0.symbol}\t | ${uFPrice}`);
    console.log(`SUSHISWAP   | ${token1.symbol}/${token0.symbol}\t | ${sFPrice}\n`);
    console.log(`Percentage Difference: ${priceDifference}%\n`);

    return priceDifference;
}

const determineDirection = async (priceDifference) => {
    console.log(`Determining Direction...\n`);

    if(priceDifference >= difference){
        console.log(`Potential Arbitrage Direction:\n`);
        console.log('Buy\t --->\t Uniswap');
        console.log('Sell\t --->\t Sushiswap\n');

        return [uRouter, sRouter];

    } else if (priceDifference <= -(difference)){
        console.log(`Potential Arbitrage Direction:\n`);
        console.log('Buy\t --->\t Sushiswap');
        console.log('Sell\t --->\t Uniswap\n');

        return [sRouter, uRouter];

    } else {
        return null;
    }
}

const determineProfitability = async(_routerPath, _token0Contract, _token0, _token1) => {
    console.log(`Determining Profitability...\n`);

    let reserves, exchangeToBuy, exchangeToSell;

    if(_routerPath[0].address == uRouter.address){
        reserves = await getReserves(sPair);
        exchangeToBuy = 'Uniswap';
        exchangeToSell = 'Sushiswap';
    } else {
        reserves = await getReserves(uPair);
        exchangeToBuy = 'Sushiswap';
        exchangeToSell = 'Uniswap';
    }

    console.log(`Reserves on ${_routerPath[1].address}`);
    console.log(`SHIB: ${Number(ethers.utils.formatUnits(reserves[0].toString(), 'ether')).toFixed(0)}`);
    console.log(`WETH: ${ethers.utils.formatUnits(reserves[1].toString(), 'ether')}\n`);

    try{
        //returns amount of WETH needed
        let result = await _routerPath[0].getAmountsIn(reserves[0], [_token0.address, _token1.address]);
    
        const token0In = result[0]; // WETH
        const token1In = result[1]; // SHIB
    
        result = await _routerPath[1].getAmountsOut(token1In, [_token1.address, _token0.address]);
    
        console.log(`Estimated amount of WETH needed to buy enough SHIB on ${exchangeToBuy}\t\t| ${ethers.utils.formatUnits(token0In, 'ether')}`);
        console.log(`Estimated amount of WETH returned after swapping SHIB on ${exchangeToSell}\t\t| ${ethers.utils.formatUnits(result[1], 'ether')}`);
    
        const { amountIn, amountOut } = await simulate(token0In, _routerPath, _token0, _token1);
        const amountDifference = amountOut - amountIn;
        const estimatedGasCost = gasLimit * gasPrice;

        const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const ethBalanceBefore = ethers.utils.formatUnits(await account.getBalance(), 'ether');
        const ethBalanceAfter = ethBalanceBefore - estimatedGasCost;

        const wethBalanceBefore = Number(ethers.utils.formatUnits(await _token0Contract.balanceOf(account.address), 'ether'));
        const wethBalanceAfter = amountDifference + wethBalanceBefore;
        const wethBalanceDifference = wethBalanceAfter - wethBalanceBefore;
    
        const data = {
            'ETH Balance Before': ethBalanceBefore,
            'ETH Balance After': ethBalanceAfter,
            'ETH Spent (gas)': estimatedGasCost,
            '-': {},
            'WETH Balance Before': wethBalanceBefore,
            'WETH Balance After': wethBalanceAfter,
            'WETH Gained/Lost': wethBalanceDifference,
            '-': {},
            'Total Gained/Lost': wethBalanceDifference - estimatedGasCost
        };

        console.table(data);
        console.log();

        if(amountOut < amountIn) {
            return false;
        }

        amount = token0In;
        return true;

    }catch(error){
        console.log(error);
        console.log(`\nError occured while trying to determine profitability...\n`);
        console.log(`This can typically happen because of liquidity issues`);
        return false;
    }
}

const executeTrade = async(_routerPath, _token0Contract, _token1Contract) => {
    console.log(`Attempting Arbitrage...\n`);

    let startOnUniswap;

    if(_routerPath[0].address = uRouter.address){
        startOnUniswap = true;
    } else {
        startOnUniswap = false;
    }

    const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const tokenBalanceBefore = await _token0Contract.balanceOf(account.address);
    const ethBalanceBefore = await account.getBalance();

    if(config.PROJECT_SETTINGS.isDeployed){
        const transaction = await arbitrage.connect(account).executeTrade(startOnUniswap, _token0Contract.address, _token1Contract.address, amount);
        const receipt = await transaction.wait();
    }

    console.log(`Trade Complete:\n`);

    const tokenBalanceAfter = await _token0Contract.balanceOf(account.address);
    const ethBalanceAfter = await account.getBalance();

    const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore;
    const ethBalanceDifference = ethBalanceBefore - ethBalanceAfter;

    const data = {
        'ETH Balance Before': ethers.utils.formatUnits(ethBalanceBefore,'ether'),
        'ETH Balance After': ethers.utils.formatUnits(ethBalanceAfter,'ether'),
        'ETH Spent (gas)': ethers.utils.formatUnits(ethBalanceDifference.toString(),'ether'),
        '-': {},
        'WETH Balance Before': ethers.utils.formatUnits(tokenBalanceBefore,'ether'),
        'WETH Balance After': ethers.utils.formatUnits(tokenBalanceAfter,'ether'),
        'WETH Gained/Lost': ethers.utils.formatUnits(tokenBalanceDifference.toString(),'ether'),
        '-': {},
        'Total Gained/Lost': `${ethers.utils.formatUnits((tokenBalanceDifference - ethBalanceDifference).toString(), 'ether')} ETH`
    };

    console.table(data);
}

main();





