const hre = require("hardhat");
const ethers = require("ethers");
require("dotenv").config();

const { getTokenAndContract, getPairContract, calculatePrice } = require('../helpers/helpers');
const { provider, qFactory, qRouter, sFactory, sRouter } = require('../helpers/initialization.js');

const V2_FACTORY_TO_USE = sFactory;
const V2_ROUTER_TO_USE = sRouter;

const UNLOCKED_ACCOUNT = "0xD8DF61bA93A84295Ab83D62dA7a8a10dE51306C2";
const AMOUNT = '10000000000';

async function main() {
    const {
        token0Contract,
        token1Contract,
        token0: ARB_AGAINST,
        token1: ARB_FOR
    } = await getTokenAndContract(process.env.ARB_AGAINST, process.env.ARB_FOR, provider);

    const pair = await getPairContract(V2_FACTORY_TO_USE, ARB_AGAINST.address, ARB_FOR.address, provider);
 
    const priceBefore = await calculatePrice(pair);

    await manipulatePrice([ARB_AGAINST, ARB_FOR], token0Contract);

    const priceAfter = await calculatePrice(pair);

    const data = {
        'Price Before': `1 WETH = ${priceBefore * (10**12)} USDC`,
        'Price After': `1 WETH = ${priceAfter * (10**12)} USDC`
    }

    console.table(data);
}

async function manipulatePrice(_path, _token0Contract) {
    console.log('\n Beginning Swap...\n');

    console.log(`Input Token: ${_path[0].symbol}`);
    console.log(`Output Token: ${_path[1].symbol}\n`);

    const amount = ethers.utils.parseUnits(AMOUNT, 'wei');
    console.log(`AMOUNT ${amount}`);
    const path = [_path[0].address, _path[1].address];
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT]
    });

    const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT);

    await _token0Contract.connect(signer).approve(V2_ROUTER_TO_USE.address, amount);
    await V2_ROUTER_TO_USE.connect(signer).swapExactTokensForTokens(amount, 0, path, signer.address, deadline);

    console.log('Swap Complete! \n');
}

main().catch((error) =>{
    console.log(error);
    process.exitCode = 1;
});
