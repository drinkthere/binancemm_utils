const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const BinanceClient = require("./clients/binance.js");
const StatOrderService = require("./services/statOrder.js");
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
const initPosition = configs["deliveryInitPositions"][account];

// 初始化同步锁
const lock = new AsyncLock();

// 初始化stat order service
const statOrderService = new StatOrderService();
const tgService = new TgService();
let noOrders = 0;
let maxNoOrdersTimes = 5;
let deliveryAccount = account + "_delivery";
let tickerMap = {};
const orderUpdateHandler = async (orders) => {
    for (let order of orders) {
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        await lock.acquire(clientOrderId, async () => {
            if (["FILLED", "PARTIALLY_FILLED"].includes(order.orderStatus)) {
                const symbol = order.symbol;
                const side = order.side;
                const quantity = order.lastFilledQuantity;
                const amount = quantity;
                const price = order.lastFilledPrice;
                const notional = order.lastFilledNotional;
                const maker = order.isMaker;

                const msg = `${deliveryAccount} ${clientOrderId} ${symbol} ${side} ${order.orderStatus} ${amount}@${price} notional:${notional} maker:${maker}`;
                log(msg);

                // 将订单写入数据库
                await statOrderService.saveOrder(
                    `tb_order_${deliveryAccount}`,
                    {
                        symbol,
                        side,
                        quantity,
                        amount,
                        price,
                        notional,
                        maker,
                    }
                );
            }
        });
    }
};

const scheduleStatProfit = () => {
    scheduleLoopTask(async () => {
        try {
            const accountInfo = await exchangeClient.getDeliveryAccount();
            const balances = accountInfo.assets;
            const positions = accountInfo.positions;
            //console.log(Object.keys(account));process.exit();

            let usdtBalanceArr = balances
                .filter((item) => item.asset == "USDT")
                .map(
                    (item) =>
                        parseFloat(item.walletBalance) +
                        parseFloat(item.crossUnPnl)
                );
            const usdtBalance =
                usdtBalanceArr.length == 0 ? 0 : parseFloat(usdtBalanceArr[0]);

            let tradingBalance = balances.reduce((total, item) => {
                let notional = 0;
                const amt =
                    parseFloat(item.walletBalance) +
                    parseFloat(item.crossUnPnl);
                if (amt > 0) {
                    if (["USDT", "USDC", "BFUSD"].includes(item.asset)) {
                        notional = amt;
                    } else {
                        notional =
                            amt * parseFloat(tickerMap[item.asset + "USDT"]);
                    }
                }
                return total + notional;
            }, 0);
            const fundingBalanceArr =
                await exchangeClient.getFundingAccountBalances();
            let fundingBalance = fundingBalanceArr.reduce((total, item) => {
                let bal = 0;
                if (["USDT", "USDC", "BFUSD"].includes(item.asset)) {
                    bal = parseFloat(item.balance);
                } else {
                    if (parseFloat(item.free) > 0) {
                        bal =
                            parseFloat(tickerMap[item.asset + "USDT"]) *
                            parseFloat(item.free);
                    }
                }
                return total + bal;
            }, 0);
            log(
                `tradingBalance=${tradingBalance}, fundingBalance=${fundingBalance}`
            );
            let notionalBTCETH = 0;
            let notionalOther = 0;
            let positionsNum = 0;
            if (positions != null) {
                for (let position of positions) {
                    if (position.positionAmt != 0) {
                        positionsNum++;
                        if (
                            position.symbol.includes("BTCUSD") ||
                            position.symbol.includes("ETHUSD")
                        ) {
                            notionalBTCETH += parseFloat(
                                position.notionalValue
                            );
                        } else {
                            notionalOther += parseFloat(position.notionalValue);
                        }
                    }
                }
            }
            const notionalAll = notionalBTCETH + notionalOther;
            let msg = `${deliveryAccount}|PositionDeltaWithBTCETH=${notionalBTCETH.toFixed(
                2
            )}|PositionDeltaWithoutBTCETH$=${notionalOther.toFixed(
                2
            )}|PositionDeltaAll=${notionalAll.toFixed(
                2
            )}|PositionCount=${positionsNum}`;
            log(msg);

            // 获取openorders数量
            let buyOrdersNum = 0;
            let sellOrdersNum = 0;
            const orders = await exchangeClient.getDeliveryOpenOrders();
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
                    //tgService.sendMsg(`${account} orders numbers warning`);
                    noOrders = 0;
                    maxNoOrdersTimes = 2 * maxNoOrdersTimes;
                }
            }

            const ordersNum = buyOrdersNum + sellOrdersNum;
            console.log(
                `The num of open orders is ${ordersNum}(B:${buyOrdersNum}|S:${sellOrdersNum})`
            );

            let marginRatioArr = await exchangeClient.getDeliveryMarginRatio();
            let minMaginRatio = 1000;
            for (let item of marginRatioArr) {
                const maintMargin = parseFloat(item.maintMargin);
                const marginBalance = parseFloat(item.marginBalance);
                const marginRatio =
                    maintMargin > 0 ? marginBalance / maintMargin : 999;
                if (marginRatio < minMaginRatio) {
                    minMaginRatio = marginRatio;
                }
            }
            console.log("marginRatio", minMaginRatio);

            await statOrderService.saveBalance({
                account: deliveryAccount,
                usdt_balance: usdtBalance.toFixed(2),
                trading_balance: tradingBalance.toFixed(2),
                funding_balance: fundingBalance.toFixed(2),
                btc_eth_delta: notionalBTCETH.toFixed(2),
                other_delta: notionalOther.toFixed(2),
                total_delta: notionalAll.toFixed(2),
                margin_ratio: minMaginRatio,
                orders_num: ordersNum,
                position_count: positionsNum,
            });
        } catch (e) {
            console.error(e);
        }
        await sleep(300 * 1000);
    });
};

const main = async () => {
    tickerMap = await exchangeClient.getSpotTickers();
    // exchangeClient.initWsEventHandler({
    //     orders: orderUpdateHandler,
    // });
    // exchangeClient.wsDeliverUserData();

    scheduleStatProfit();
};
main();
