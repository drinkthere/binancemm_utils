const AsyncLock = require("async-lock");
const {
    scheduleLoopTask,
    sleep,
    fileExists,
    formatQtyCeil,
} = require("./utils/run");
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

let { account, intranet } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node testTickerSpeed.js --account=xxx");
    process.exit();
}
intranet = intranet == "true" ? true : false;
const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
    intranet,
};
const exchangeClient = new BinanceClient(options);
const precisionMap = {};

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const genOrderPrecisionMap = async () => {
    const resp = await exchangeClient.getExchangeInfo();
    for (let symbolInfo of resp.symbols) {
        let lotSize = "";
        let minSize = "";
        for (let filter of symbolInfo.filters) {
            if (filter.filterType == "LOT_SIZE") {
                lotSize = filter.stepSize;
                minSize = filter.minQty;
            }
        }
        precisionMap[symbolInfo.symbol] = {
            lotSz: lotSize,
            minSz: minSize,
        };
    }
};
const buyBNB = async (bnbBal) => {
    scheduleLoopTask(async () => {
        try {
            // 获取tickers
            const tickerMap = await exchangeClient.getSpotTickers();

            // 获取position
            const spotBalances = await exchangeClient.getSpotBalances();

            const filteredArr = spotBalances.filter((item) => {
                return item.asset == "BNB";
            });
            const bnbBalArr = filteredArr[0];
            const currentBnbBal =
                parseFloat(bnbBalArr.free) + parseFloat(bnbBalArr.locked);
            const buyQty = bnbBal - currentBnbBal;
            if (buyQty <= 0) {
                console.log("BNB is enough");
                process.exit();
            } else {
                console.log(`Need to buy ${buyQty} BNB`);
                const symbol = "BNBUSDT";
                const tickerPrice = parseFloat(tickerMap[symbol]);
                const precision = precisionMap[symbol];
                const minQty = calculateMinQty(tickerPrice, precision);
                let orderQty = Math.max(buyQty, minQty);
                const qtyPrecision = precision["lotSz"];
                orderQty = formatQtyCeil(orderQty, qtyPrecision);
                console.log(`Actually prepare to buy ${orderQty} BNB`);
                try {
                    await exchangeClient.cancelAllSpotOrders(symbol);
                } catch (e) {}

                const clientOrderId = genClientOrderId();
                const result = await exchangeClient.placeSpotOrder(
                    "BUY",
                    symbol,
                    buyQty,
                    tickerPrice,
                    {
                        type: "LIMIT",
                        newClientOrderId: clientOrderId,
                    }
                );
                console.log(result);
            }
        } catch (e) {
            // 防止没有挂单的时候取消订单失败
        }
        await sleep(20 * 1000);
    });
};

const calculateMinQty = (tickerPrice, precisionMap) => {
    let minQty = parseFloat(precisionMap["minSz"]);
    const stepQty = parseFloat(precisionMap["lotSz"]);
    while (tickerPrice * minQty < 5) {
        minQty += stepQty;
    }
    return minQty;
};

const main = async () => {
    let buyBnb = 0.901;
    await genOrderPrecisionMap();
    await buyBNB(buyBnb);
};
main();
