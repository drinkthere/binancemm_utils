const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const BinanceClient = require("./clients/binance");
const symbol = "POLUSDT";
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

let { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node testUsingSDK.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: "172.31.16.160",
    intranet: false,
};
const exchangeClient = new BinanceClient(options);

const tickerUpdateHandler = async (ticker) => {
    console.log(ticker);
};

const main = async () => {
    exchangeClient.initWsEventHandler({
        tickers: tickerUpdateHandler,
    });
    exchangeClient.wsFuturesBookTicker();
};
main();
