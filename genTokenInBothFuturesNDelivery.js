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
    //console.log(dSymbols, dSymbols.length)
    const uniqueDSymbol = [...new Set(dSymbols)];

    // 获取margin支持的asset
    const fExInfo = await exchangeClient.getFuturesExchangeInfo();
    const fSymbols = fExInfo.symbols
        .filter((item) => item.status == "TRADING")
        .map((item) => item.baseAsset);
    //console.log(fSymbols, fSymbols.length)

    // 取交集
    const intersection = uniqueDSymbol.filter((item) =>
        fSymbols.includes(item)
    );
    //console.log(intersection, intersection.length)
    dExInfo.symbols.map((item) => {
        if (
            intersection.includes(item.baseAsset) &&
            item.symbol.endsWith("_PERP")
        ) {
            console.log(
                item.symbol,
                item.pricePrecision,
                item.quantityPrecision
            );
        }
    });
};
main();
