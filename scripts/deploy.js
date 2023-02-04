//const hre = require("hardhat");
const ethers = require("ethers");
require("dotenv").config();
const contractExtras = require("../artifacts/contracts/Arbitrage.sol/Arbitrage.json");
const config = require("../config.json");
const {provider, a, b, c, d, e} = require('../helpers/initialization');

let abi = JSON.parse(contractExtras.abi);
const byteCode = JSON.parse(contractExtras.byteCode);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const factory = new ethers.ContractFactory(abi, byteCode, wallet);

async function main() {
    //const Arbitrage = await hre.ethers.getContractFactory("Arbitrage");

    const contract = await factory.deploy(
        config.SUSHISWAP.V2_ROUTER_02_ADDRESS,
        config.UNISWAP.V2_ROUTER_02_ADDRESS
    );

    await contract.deployed();

    console.log(`Arbitrage contract deployed to ${contract.address}`);
    console.log(`${contract.deployTransaction}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});