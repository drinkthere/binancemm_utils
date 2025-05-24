const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const { sleep, fileExists, convertToTimestamp } = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account, symbol } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node mgProfit.js --account=xxx --symbol=yyy");
    process.exit();
}

if (symbol == null) {
    log("node mgProfit.js --account=xxx --symbol=yyy");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const main = async () => {
    const startTime = convertToTimestamp("2025-03-16 00:00:00");
    const resp = await exchangeClient.listMarginTrades(
        symbol,
        null,
        startTime,
        null,
        1
    );
    const fromId = resp[0].id;
    const trades = await exchangeClient.listMarginTrades(symbol, fromId);

    // 交易统计
    const stats = {
        totalBuyQty: 0,
        totalSellQty: 0,
        totalBuyCost: 0,
        totalSellRevenue: 0,
        totalCommission: 0,
        buyTrades: 0,
        sellTrades: 0,
    };
    trades.sort((a, b) => a.time - b.time);
    for (let trade of trades) {
        const price = parseFloat(trade.price);
        const qty = parseFloat(trade.qty);
        const commission = parseFloat(trade.commission);

        // 累计手续费
        stats.totalCommission += commission;

        if (trade.isBuyer) {
            // 买入交易
            stats.totalBuyQty += qty;
            stats.totalBuyCost += price * qty;
            stats.buyTrades++;
        } else {
            // 卖出交易
            stats.totalSellQty += qty;
            stats.totalSellRevenue += price * qty;
            stats.sellTrades++;
        }
    }
    const avgBuyPrice =
        stats.totalBuyQty > 0 ? stats.totalBuyCost / stats.totalBuyQty : 0;

    // 可以对平仓的部分计算盈亏
    const closedQty = Math.min(stats.totalBuyQty, stats.totalSellQty);

    // 计算已实现盈亏
    const realizedPnL = stats.totalSellRevenue - avgBuyPrice * closedQty;

    console.log(realizedPnL);
};
main();
