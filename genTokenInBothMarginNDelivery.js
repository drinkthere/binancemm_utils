const BinanceClient = require("./clients/binance");
const { sleep, fileExists } = require("./utils/run");
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
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const main = async () => {
    // 获取delivery支持的asset
    const dExInfo = await exchangeClient.getDeliveryExchangeInfo();
    const dSymbols = dExInfo.symbols
        .filter((item) => item.contractStatus == "TRADING")
        .map((item) => item.baseAsset);
    // console.log(dSymbols, dSymbols.length)

    // 获取margin支持的asset
    const mgAllAssets = await exchangeClient.getMarginAllAssets();
    const mgSymbols = mgAllAssets
        .filter((item) => item.isBorrowable)
        .map((item) => item.assetName);
    // console.log(mgSymbols, mgSymbols.length)

    // 取交集
    const intersection = dSymbols.filter((item) => mgSymbols.includes(item));

    // 去重
    const uniqueIntersection = [...new Set(intersection)];

    console.log(uniqueIntersection, uniqueIntersection.length);
};
main();
