const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const {
    sleep,
    fileExists,
    scheduleLoopTask,
    getDecimals,
    formatQty,
    formatQtyCeil,
} = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account, symbol } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node cancel.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};

const exchangeClient = new BinanceClient(options);

const transferDust = async () => {
    const result = exchangeClient.transferDust(["1000CAT"]);
    console.log(result);
};

const main = async () => {
    await transferDust();
};
main();
