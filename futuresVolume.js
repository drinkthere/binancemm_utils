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
    log("node stat.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];
let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

let futuresSymbolMap = {};
const main = async () => {
    await init();

    await statDailyVolume("2024-10-20");
};

const init = async () => {
    const exchangeInfo = await exchangeClient.getFuturesExchangeInfo();
    futuresSymbolMap = exchangeInfo.symbols
        .filter(
            (item) =>
                item.status == "TRADING" &&
                !["BTCUSDT", "ETHUSDT"].includes(item.symbol)
        )
        .reduce((map, item) => {
            map[item.symbol] = item.status;
            return map;
        }, {});
    //console.log(futuresSymbolMap);process.exit();
};

const statDailyVolume = async (endDate) => {
    const notionalStat = {};
    let total = 0;
    const limit = 7;
    // 获取所有symbols在date的日K线
    for (let symbol of Object.keys(futuresSymbolMap)) {
        let startDate = endDate;
        const klines = await exchangeClient.getFuturesKline(symbol, "1d", {
            endTime: convertDateToTs(endDate),
            limit,
        });

        for (let i = limit - 1; i >= 0; i--) {
            let notional = 0;
            if (typeof klines[i] !== "undefined") {
                notional = parseFloat(klines[i][7]);
            }
            if (Object.keys(notionalStat).includes(startDate)) {
                notionalStat[startDate] += notional;
            } else {
                notionalStat[startDate] = notional;
            }
            total += notional;
            startDate = subOneDay(startDate);
        }
        await sleep(100);
    }
    //console.log(notionalStat)
    for (let key in notionalStat) {
        console.log(key, notionalStat[key].toLocaleString());
    }
    console.log(limit, " days total notional is ", total.toLocaleString());
};

const convertDateToTs = (dateString) => {
    const date = new Date(dateString + "T00:00:00Z");
    return date.getTime();
};

const subOneDay = (dateString) => {
    let currentDate = new Date(dateString);
    currentDate.setDate(currentDate.getDate() - 1);

    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0"); // 月份从 0 开始
    const day = String(currentDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};
main();
