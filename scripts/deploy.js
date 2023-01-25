const hre = require("hardhat");
const ethers = require("ethers");
const config = require("../config.json");

async function main() {
    const Arbitrage = await hre.ethers.getContractFactory("Arbitrage");
    const arbitrage = await Arbitrage.deploy(
        config.SUSHISWAP.V2_ROUTER_02_ADDRESS,
        config.UNISWAP.V2_ROUTER_02_ADDRESS
    );

    await arbitrage.deployed();

    console.log(`Arbitrage contract deployed to ${arbitrage.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});