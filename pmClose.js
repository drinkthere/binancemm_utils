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
    log("node pmClose.js --account=xxx");
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
        const tickerMap = await exchangeClient.getDeliveryTickers();

        // 获取position
        const cmPositions = await exchangeClient.pmGetCmPositions();
        const positions = cmPositions.filter((i) => i.positionAmt != 0);

        let i = 0;
        if (positions != null && positions.length > 0) {
            for (let position of positions) {
                // if (['BTCUSD_PERP', 'ETHUSD_PERP'].includes(position.symbol)) {
                // 	continue;
                // }
                await exchangeClient.pmCancelAllCmOrder(position.symbol);

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
                    await exchangeClient.pmPlaceCmOrder(
                        "SELL",
                        position.symbol,
                        Math.abs(position.positionAmt),
                        ticker.askPrice,
                        {
                            newClientOrderId: genClientOrderId(),
                        }
                    );
                } else if (position.positionAmt < 0) {
                    await exchangeClient.pmPlaceCmOrder(
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
        console.log(`still ${i} positions need to be close`);
        await sleep(20 * 1000);
    });
};

const main = async () => {
    closePositions();
};
main();
