const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const BinanceClient = require("./clients/binance.js");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node flexibleloan.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const listOngoingOrders = async (loanCoin = "", collateralCoin = "") => {
    return await exchangeClient.flexibleLoanOngoingOrders(
        loanCoin,
        collateralCoin
    );
};

const borrow = async (
    loanCoin,
    collateralCoin,
    loanAmount,
    collateralAmount
) => {
    return await exchangeClient.flexibleLoanBorrow(
        loanCoin,
        collateralCoin,
        loanAmount,
        collateralAmount
    );
};

const main = async () => {
    // const resp = await listOngoingOrders()
    // console.log(resp)

    const bresp = await borrow("ETH", "USDT", 0.005, 50);
    console.log(bresp);
};
main();
