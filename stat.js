const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { log } = require("./utils/log");
const BinanceClient = require("./clients/binance");
const StatOrderService = require("./services/statOrder");
const TgService = require("./services/tg.js");
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

// 初始化同步锁
const lock = new AsyncLock();

// 初始化stat order service
const statOrderService = new StatOrderService();
const tgService = new TgService();
let noOrders = 0;
let maxNoOrdersTimes = 5;

const orderUpdateHandler = async (orders) => {
    for (let order of orders) {
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        await lock.acquire(clientOrderId, async () => {
            if (["FILLED"].includes(order.orderStatus)) {
                const symbol = order.symbol;
                const side = order.side;
                const quantity = order.lastFilledQuantity;
                const amount = quantity;
                const price = order.lastFilledPrice;
                const notional = order.lastFilledNotional;
                const maker = order.isMaker;

                const msg = `${account} ${clientOrderId} ${symbol} ${side} ${order.orderStatus} ${amount}@${price}`;
                log(msg);

                // 将订单写入数据库
                await statOrderService.saveOrder(`tb_order_${account}`, {
                    symbol,
                    side,
                    quantity,
                    amount,
                    price,
                    notional,
                    maker,
                });
            }
        });
    }
};

const scheduleStatProfit = () => {
    scheduleLoopTask(async () => {
        try {
            const tickersMap = await exchangeClient.getFuturesTickers();
            const balances = await exchangeClient.getFuturesBalances();
            let usdtBalanceArr = balances
                .filter((item) => item.asset == "USDT")
                .map(
                    (item) =>
                        parseFloat(item.balance) + parseFloat(item.crossUnPnl)
                );
            const usdtBalance =
                usdtBalanceArr.length == 0 ? 0 : parseFloat(usdtBalanceArr[0]);

            let usdcBalanceArr = balances
                .filter((item) => item.asset == "USDC")
                .map(
                    (item) =>
                        parseFloat(item.balance) + parseFloat(item.crossUnPnl)
                );
            const usdcBalance =
                usdcBalanceArr.length == 0 ? 0 : parseFloat(usdcBalanceArr[0]);

            const usdtPlusUsdcBalance = usdtBalance + usdcBalance;

            let tradingBalance = balances.reduce((total, item) => {
                let bal = 0;
                if (item.asset == "USDT" || item.asset == "USDC") {
                    bal =
                        parseFloat(item.balance) + parseFloat(item.crossUnPnl);
                } else {
                    if (parseFloat(item.balance) > 0) {
                        bal =
                            parseFloat(
                                tickersMap[item.asset + "USDT"]["bidPrice"]
                            ) *
                            (parseFloat(item.balance) +
                                parseFloat(item.crossUnPnl));
                    }
                }
                return total + bal;
            }, 0);

            const fundingBalanceArr =
                await exchangeClient.getFundingAccountBalances();
            let fundingBalance = fundingBalanceArr.reduce((total, item) => {
                let bal = 0;
                if (item.asset == "USDT") {
                    bal = parseFloat(item.balance);
                } else {
                    if (parseFloat(item.free) > 0) {
                        bal =
                            parseFloat(
                                tickersMap[item.asset + "USDT"]["bidPrice"]
                            ) * parseFloat(item.free);
                    }
                }
                return total + bal;
            }, 0);
            log(
                `tradingBalance=${tradingBalance}, fundingBalance=${fundingBalance}`
            );

            const positions = await exchangeClient.getFuturesPositions();
            let notionalBTCETH = 0;
            let notionalOther = 0;
            let positionsNum = 0;
            if (positions != null) {
                for (let position of positions) {
                    if (position.positionAmt != 0) {
                        positionsNum++;
                        if (["ETHUSDT", "BTCUSDT"].includes(position.symbol)) {
                            notionalBTCETH += parseFloat(position.notional);
                        } else {
                            notionalOther += parseFloat(position.notional);
                        }
                    }
                }
            }
            const notionalAll = notionalBTCETH + notionalOther;
            let msg = `${account} USDTBalance=${usdtBalance.toFixed(
                2
            )}|USDCBalance=${usdcBalance.toFixed(
                2
            )}|PositionDeltaWithBTCETH=${notionalBTCETH.toFixed(
                2
            )}|PositionDeltaWithoutBTCETH$=${notionalOther.toFixed(
                2
            )}|PositionDeltaAll=${notionalAll.toFixed(
                2
            )}|PositionCount=${positionsNum}`;
            log(msg);

            // 获取margin ratio
            let marginRatio = await exchangeClient.getFuturesMarginRatio();
            marginRatio = marginRatio ? marginRatio : 0;

            // 获取openorders数量
            let buyOrdersNum = 0;
            let sellOrdersNum = 0;
            const orders = await exchangeClient.getFuturesOpenOrders();
            if (orders && orders.length > 2) {
                for (let order of orders) {
                    if (order.positionAmt != 0) {
                        if (order.side == "BUY") {
                            buyOrdersNum++;
                        } else {
                            sellOrdersNum++;
                        }
                    }
                }
                noOrders = 0;
                maxNoOrdersTimes = 5;
            } else {
                noOrders++;
                if (noOrders >= maxNoOrdersTimes) {
                    // 报警
                    tgService.sendMsg(`${account} orders numbers warning`);
                    noOrders = 0;
                    maxNoOrdersTimes = 2 * maxNoOrdersTimes;
                }
            }

            const ordersNum = buyOrdersNum + sellOrdersNum;
            console.log(
                `The num of open orders is ${ordersNum}(B:${buyOrdersNum}|S:${sellOrdersNum})`
            );

            // 将订单写入数据库
            await statOrderService.saveBalance({
                account,
                usdt_balance: usdtPlusUsdcBalance.toFixed(2),
                trading_balance: tradingBalance.toFixed(2),
                funding_balance: fundingBalance.toFixed(2),
                btc_eth_delta: notionalBTCETH.toFixed(2),
                other_delta: notionalOther.toFixed(2),
                total_delta: notionalAll.toFixed(2),
                margin_ratio: marginRatio.toFixed(2),
                orders_num: ordersNum,
                position_count: positionsNum,
            });
        } catch (e) {
            console.error(e);
        }
        await sleep(120 * 1000);
    });
};

const main = async () => {
    exchangeClient.initWsEventHandler({
        orders: orderUpdateHandler,
    });
    exchangeClient.wsFuturesUserData();

    scheduleStatProfit();
};
main();
