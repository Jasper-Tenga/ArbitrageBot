require("dotenv").config();
const ethers = require("ethers");

const config = require('../config.json');
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json');
const IUniswapV2Factory = require('@uniswap/v2-core/build/IUniswapV2Factory.json');
const IArbitrage = require('../artifacts/contracts/Arbitrage.sol/Arbitrage.json');

let provider;

if(config.PROJECT_SETTINGS.isLocal) {
    //provider = new hre.ethers.providers.WebSocketProvider("ws://127.0.0.1:8545/");
    provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
} else {
    provider = new hre.ethers.providers.WebSocketProvider(`wss://mainnet.infura.io/ws/v3/${process.env.INFURA_API_KEY}`);
}

const uFactory = new ethers.Contract(config.UNISWAP.FACTORY_ADDRESS, IUniswapV2Factory.abi, provider);
const uRouter = new ethers.Contract(config.UNISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, provider);
const sFactory = new ethers.Contract(config.SUSHISWAP.FACTORY_ADDRESS, IUniswapV2Factory.abi, provider);
const sRouter = new ethers.Contract(config.SUSHISWAP.V2_ROUTER_02_ADDRESS, IUniswapV2Router02.abi, provider);

const arbitrage = new ethers.Contract(config.PROJECT_SETTINGS.ARBITRAGE_ADDRESS, IArbitrage.abi, provider);

module.exports = {
    provider,
    uFactory,
    uRouter,
    sFactory,
    sRouter,
    arbitrage
}






