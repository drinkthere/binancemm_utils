const OkxClient = require("./clients/okx");
const { v4: uuidv4 } = require("uuid");
const {
    scheduleLoopTask,
    sleep,
    convertScientificToString,
    fileExists,
} = require("./utils/run");
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
// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();
const apiKeyArr = process.env.OKX_STAT_API_KEY.split(",");
const apiSecretArr = process.env.OKX_STAT_API_SECRET.split(",");
const apiPasswordArr = process.env.OKX_STAT_API_PASSWORD.split(",");

let options = {
    API_KEY: apiKeyArr[keyIndex],
    API_SECRET: apiSecretArr[keyIndex],
    API_PASSWORD: apiPasswordArr[keyIndex],
    market: configs.market[account],
    localAddress: configs.okxLocalAddress[account],
};
const exchangeClient = new OkxClient(options);

const cancelOrders = async () => {
    if (symbol != null) {
        await exchangeClient.cancelAllFuturesOrders(symbol);
    } else {
        for (let sbl of ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "MATIC-USDT-SWAP"]) {
            await exchangeClient.cancelAllFuturesOrders(sbl);
            await sleep(1000);
        }
    }
};

const main = async () => {
    await cancelOrders();
};
main();
