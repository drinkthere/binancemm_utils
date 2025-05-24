const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const {
    sleep,
    fileExists,
    scheduleLoopTask,
    getDecimals,
    formatQty,
    formatQtyCeil,
} = require("./utils/run");
const { log } = require("./utils/log");
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

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};

const exchangeClient = new BinanceClient(options);
const initPositionMap = configs["spotInitPositions"][account] || {};
const precisionMap = {};

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const genOrderPrecisionMap = async () => {
    const resp = await exchangeClient.getSpotExchangeInfo();
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

const getUsdtBalance = (positions) => {
    for (let position of positions) {
        if ("USDT" == position.asset) {
            return position;
        }
    }
    return null;
};

const calculateMinQty = (tickerPrice, precisionMap) => {
    let minQty = parseFloat(precisionMap["minSz"]);
    const stepQty = parseFloat(precisionMap["lotSz"]);
    while (tickerPrice * minQty < 5) {
        minQty += stepQty;
    }
    return minQty;
};

const closePositions = async () => {
    let step = 0;
    scheduleLoopTask(async () => {
        // 获取tickers
        const tickerMap = await exchangeClient.getSpotTickers();

        // 获取position
        const mgAccount = await exchangeClient.getMarginAccount();
        const positions = mgAccount.userAssets.filter((item) => {
            return (
                item.free != 0 ||
                item.locked != 0 ||
                item.borrowed != 0 ||
                item.interest != 0
            );
        });

        if (step == 0) {
            // 还款
            let i = 0;
            if (positions != null && positions.length > 0) {
                for (let position of positions) {
                    if (["USDT", "BNB"].includes(position.asset)) {
                        continue;
                    }

                    const symbol = position.asset + "USDT";
                    await exchangeClient.cancelAllMarginOrders(symbol);

                    const tickerPrice = parseFloat(tickerMap[symbol]);

                    if (tickerPrice == "") {
                        log(`${symbol}'s ticker is empty`);
                        continue;
                    }
                    const initPosition = Object.keys(initPositionMap).includes(
                        position.asset
                    )
                        ? initPositionMap[position.asset]
                        : 0;
                    const precision = precisionMap[symbol];
                    const qtyPrecision = precision["lotSz"];
                    const minQty = calculateMinQty(tickerPrice, precision);
                    if (position.borrowed > 0 || position.interest > 0) {
                        if (position.netAsset < 0) {
                            i++;
                            // qty 是满足下单要求的一个负数
                            let orderQty = initPosition - position.netAsset;
                            orderQty = Math.max(orderQty, minQty);
                            orderQty = formatQtyCeil(orderQty, qtyPrecision);

                            // 先市价购买这些qty
                            console.log(
                                `Limit buy ${orderQty} ${position.asset}`
                            );
                            const clientOrderId = genClientOrderId();
                            await exchangeClient.placeMarginOrder(
                                "BUY",
                                symbol,
                                orderQty,
                                tickerPrice.toString(),
                                {
                                    type: "LIMIT",
                                    newClientOrderId: clientOrderId,
                                }
                            );
                            await sleep(500);
                        } else {
                            // 还款
                            const repayAmoumt =
                                parseFloat(position.borrowed) +
                                parseFloat(position.interest);
                            if (repayAmoumt > 0.00001) {
                                console.log(
                                    `repay ${position.asset} ${repayAmoumt}(b:${position.borrowed} + i:${position.interest})`
                                );
                                const rResult =
                                    await exchangeClient.marginRepay(
                                        position.asset,
                                        repayAmoumt
                                    );
                                console.log(rResult);
                            }
                        }
                    }
                }

                if (i == 0) {
                    console.log(`all positions have been repayed`);
                    const filterArr = positions.filter(
                        (item) => item.asset == "BNB"
                    );
                    if (filterArr.length > 0) {
                        const bnbBal = filterArr[0];
                        const repayAmoumt =
                            parseFloat(bnbBal.borrowed) +
                            parseFloat(bnbBal.interest);
                        if (repayAmoumt > 0.00001) {
                            console.log(
                                `repay ${bnbBal.asset} ${repayAmoumt}(b:${bnbBal.borrowed} + i:${bnbBal.interest})`
                            );
                            const rResult = await exchangeClient.marginRepay(
                                bnbBal.asset,
                                repayAmoumt
                            );
                            console.log(rResult);
                        }
                    }

                    step = 1;
                } else {
                    console.log(`still ${i} positions need to be repay`);
                    await sleep(20 * 1000);
                }
            }
        } else {
            // 平仓
            let i = 0;
            if (positions != null && positions.length > 0) {
                for (let position of positions) {
                    if (["USDT", "BNB"].includes(position.asset)) {
                        continue;
                    }

                    const symbol = position.asset + "USDT";
                    await exchangeClient.cancelAllMarginOrders(symbol);
                    const tickerPrice = parseFloat(tickerMap[symbol]);

                    if (tickerPrice == "") {
                        log(`${symbol}'s ticker is empty`);
                        continue;
                    }
                    const initPosition = Object.keys(initPositionMap).includes(
                        position.asset
                    )
                        ? initPositionMap[position.asset]
                        : 0;
                    const precision = precisionMap[symbol];
                    const qtyPrecision = precision["lotSz"];
                    const minQty = parseFloat(precision["minSz"]);

                    const closeQty = position.netAsset - initPosition;
                    const qty = formatQty(closeQty, qtyPrecision);
                    if (
                        Math.abs(qty) < minQty ||
                        tickerPrice * Math.abs(qty) < 5
                    ) {
                        log(`${symbol}'s quantity is less than min size`);
                        continue;
                    }

                    i++;
                    console.log(
                        `postion ${symbol}, ${closeQty}, ${tickerPrice}`,
                        `qtyPrcesion: ${qtyPrecision}, qty=${qty}`
                    );
                    if (qty > 0) {
                        const clientOrderId = genClientOrderId();
                        await exchangeClient.placeMarginOrder(
                            "SELL",
                            symbol,
                            qty,
                            tickerPrice.toString(),
                            {
                                type: "LIMIT",
                                newClientOrderId: clientOrderId,
                            }
                        );
                    } else {
                        const clientOrderId = genClientOrderId();
                        await exchangeClient.placeMarginOrder(
                            "BUY",
                            symbol,
                            Math.abs(qty),
                            tickerPrice.toString(),
                            {
                                type: "LIMIT",
                                newClientOrderId: clientOrderId,
                            }
                        );
                    }

                    await sleep(500);
                }

                if (i == 0) {
                    // USDT 还款
                    const position = getUsdtBalance(positions);
                    const repayAmount =
                        parseFloat(position.borrowed) +
                        parseFloat(position.interest);
                    if (repayAmount > 0.00001) {
                        console.log(
                            `repay ${position.asset} ${repayAmount}(b:${position.borrowed} + i:${position.interest})`
                        );
                        const rResult = await exchangeClient.marginRepay(
                            position.asset,
                            repayAmount
                        );
                        console.log(rResult);
                    }

                    console.log(`all positions have been closed`);
                    process.exit();
                } else {
                    console.log(`still ${i} positions need to be close`);
                    await sleep(20 * 1000);
                }
            }
        }
    });
};

const main = async () => {
    await genOrderPrecisionMap();
    await closePositions();
};
main();
