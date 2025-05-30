const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const { sleep, fileExists, scheduleLoopTask } = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node close.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const closePositions = async () => {
    scheduleLoopTask(async () => {
        // 获取tickers
        const tickerMap = await exchangeClient.getFuturesTickers();

        // 获取position
        let positions = await exchangeClient.getFuturesPositions();
        positions = positions.filter((i) => i.positionAmt != 0);

        let i = 0;
        if (positions != null && positions.length > 0) {
            for (let position of positions) {
                // if (["BTCUSDT", "ETHUSDT"].includes(position.symbol)) {
                //     continue;
                // }
                await exchangeClient.cancelAllFuturesOrders(position.symbol);

                if (position.positionAmt == 0) {
                    continue;
                }
                i++;

                const ticker = tickerMap[position.symbol];
                if (ticker == null) {
                    log(`${position.symbol}'s ticker is null`);
                    continue;
                }
                console.log(
                    `postion ${position.symbol} ${position.positionAmt}, ticker:`,
                    ticker
                );

                if (position.positionAmt > 0) {
                    await exchangeClient.placeFuturesOrder(
                        "SELL",
                        position.symbol,
                        Math.abs(position.positionAmt),
                        ticker.askPrice,
                        {
                            newClientOrderId: genClientOrderId(),
                        }
                    );
                } else if (position.positionAmt < 0) {
                    await exchangeClient.placeFuturesOrder(
                        "BUY",
                        position.symbol,
                        Math.abs(position.positionAmt),
                        ticker.bidPrice,
                        {
                            newClientOrderId: genClientOrderId(),
                        }
                    );
                }
                await sleep(500);
            }
        }
        if (i == 0) {
            console.log(`all positions have been closed`);
            process.exit();
        } else {
            console.log(`still ${i} positions need to be close`);
            await sleep(20 * 1000);
        }
    });
};

const main = async () => {
    closePositions();
};
main();
