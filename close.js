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

const { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node close.js --account=xxx");
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

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const closePositions = async () => {
    scheduleLoopTask(async () => {
        // 获取tickers
        const tickerMap = await exchangeClient.getFuturesTickers();

        // 获取position
        const positions = await exchangeClient.getPositions();

        let i = 0;
        if (positions != null && positions.length > 0) {
            for (let position of positions) {
                // if (['BTC-USDT-SWAP', 'ETH-USDT-SWAP'].includes(position.symbol)) {
                // 	continue;
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
                        ticker.bestAsk,
                        {
                            newClientOrderId: genClientOrderId(),
                        }
                    );
                } else if (position.positionAmt < 0) {
                    await exchangeClient.placeFuturesOrder(
                        "BUY",
                        position.symbol,
                        Math.abs(position.positionAmt),
                        ticker.bestBid,
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
