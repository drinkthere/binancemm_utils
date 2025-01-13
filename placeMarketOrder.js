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
        console.log(`still ${i} positions need to be close`);
        await sleep(20 * 1000);
    });
};

const main = async () => {
    const symbolsMap = {
        BTCUSDT: {
            price: 98000,
            qty: 0,
        },
        ETHUSDT: {
            price: 3750,
            qty: 0,
        },
    };
    const symbols = Object.keys(symbolsMap);
    let positions = await exchangeClient.getFuturesPositions();

    positions = positions.filter((i) => symbols.includes(i.symbol));
    for (let pos of positions) {
        for (let symbol of symbols) {
            if (pos.symbol == symbol) {
                symbolsMap[symbol].qty = parseFloat(pos.positionAmt);
            }
        }
    }

    for (let symbol of symbols) {
        const orderInfo = symbolsMap[symbol];
        if (orderInfo.qty > 0) {
            await exchangeClient.placeFuturesOrder(
                "SELL",
                symbol,
                Math.abs(orderInfo.qty),
                orderInfo.price,
                {
                    newClientOrderId: genClientOrderId(),
                }
            );
        } else if (orderInfo.qty < 0) {
            await exchangeClient.placeFuturesOrder(
                "BUY",
                symbol,
                Math.abs(orderInfo.qty),
                orderInfo.price,
                {
                    newClientOrderId: genClientOrderId(),
                }
            );
        }
    }
};
main();
