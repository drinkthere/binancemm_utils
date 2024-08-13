const BinanceClient = require("./clients/binance");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node getAccountInfo.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    apiKey: configs.keyMap[account].apiKey,
    apiSecret: configs.keyMap[account].apiSecret,
    localAddress: configs.binanceLocalAddress[account],
};

const exchangeClient = new BinanceClient(options);

const tickerCallback = (result) => {
    console.log(result);
};

const main = async () => {
    try {
        exchangeClient.initWsEventHandler({
            tickers: tickerCallback,
        });

        exchangeClient.wsDeliveryBookTicker();
    } catch (e) {
        console.error(e);
    }
};
main();
