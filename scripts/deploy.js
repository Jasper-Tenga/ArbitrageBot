//const hre = require("hardhat");
const ethers = require("ethers");
require("dotenv").config();
const contractExtras = require("../artifacts/contracts/Arbitrage.sol/Arbitrage.json");
const config = require("../config.json");
const {provider, a, b, c, d, e} = require('../helpers/initialization');

const abi = contractExtras.abi;
const byteCode = contractExtras.bytecode;

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const factory = new ethers.ContractFactory(abi, byteCode, wallet);

async function main() {
    //const Arbitrage = await hre.ethers.getContractFactory("Arbitrage");
    const feeData = await provider.getFeeData();
    console.log(ethers.utils.formatUnits(feeData.maxFeePerGas, "gwei"));

    const contract = await factory.deploy(
        config.SUSHISWAP.V2_ROUTER_02_ADDRESS,
        config.UNISWAP.V2_ROUTER_02_ADDRESS, {gasPrice: feeData.maxFeePerGas}
    );

    await contract.deployed();

    console.log(`Arbitrage contract deployed to ${contract.address}`);
    console.log(`${contract.deployTransaction}`);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});