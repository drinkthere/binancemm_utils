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

// 初始化同步锁
const lock = new AsyncLock();

// 初始化stat order service
const statOrderService = new StatOrderService();
const tgService = new TgService();
let noOrders = 0;
let maxNoOrdersTimes = 5;
let contractSizeMap = {};

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
                const notional = contractSizeMap[order.symbol];
                const maker = order.isMaker;

                const msg = `${account} ${clientOrderId} ${symbol} ${side} ${order.orderStatus} ${amount}@${price}`;
                log(msg);

                // 将订单写入数据库
                await statOrderService.saveOrder(`tb_cmm_order_${account}`, {
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
            const balMap = {};
            const balances = await exchangeClient.pmGetBalance();
            balances.map((item) => {
                if (parseFloat(item.totalWalletBalance) != 0) {
                    balMap[item.asset] = parseFloat(item.totalWalletBalance);
                }
            });
            log("balMap:");
            console.log(balMap);

            const positions = await exchangeClient.pmGetCmPositions();
            let notionalBTCETH = 0;
            let notionalOther = 0;
            let positionsNum = 0;
            if (positions != null) {
                for (let position of positions) {
                    if (position.positionAmt != 0) {
                        console.log(position);
                        positionsNum++;
                        if (
                            position.symbol.includes("BTCUSD") ||
                            position.symbol.includes("ETHUSD")
                        ) {
                            notionalBTCETH +=
                                parseInt(position.positionAmt, 10) *
                                contractSizeMap[position.symbol];
                        } else {
                            notionalOther +=
                                parseInt(position.positionAmt, 10) *
                                contractSizeMap[position.symbol];
                        }
                    }
                }
            }

            const notionalAll = notionalBTCETH + notionalOther;
            let msg = `${account}|PositionDeltaWithBTCETH=${notionalBTCETH.toFixed(
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
            const orders = await exchangeClient.pmGetCmOpenOrders();
            if (orders && orders.length > 2) {
                for (let order of orders) {
                    if (order.side == "BUY") {
                        buyOrdersNum++;
                    } else {
                        sellOrdersNum++;
                    }
                }
                noOrders = 0;
                maxNoOrdersTimes = 5;
            } else {
                noOrders++;
                if (noOrders >= maxNoOrdersTimes) {
                    // 报警
                    tgService.sendMsg(`pmcm ${account} orders numbers warning`);
                    noOrders = 0;
                    maxNoOrdersTimes = 2 * maxNoOrdersTimes;
                }
            }

            const ordersNum = buyOrdersNum + sellOrdersNum;
            console.log(
                `The num of open orders is ${ordersNum}(B:${buyOrdersNum}|S:${sellOrdersNum})`
            );

            // 获取margin ratio
            let marginRatio = await exchangeClient.umGetMarginRatio();
            console.log("marginRatio", marginRatio);
            // 为了兼容普通的币本位
            const marginRatioMap = { Total: marginRatio };

            // 将统计信息写入数据库
            await statOrderService.saveCoinMmInfo({
                account,
                btc_eth_delta: notionalBTCETH.toFixed(2),
                other_delta: notionalOther.toFixed(2),
                total_delta: notionalAll.toFixed(2),
                orders_num: ordersNum,
                position_count: positionsNum,
            });

            // 将balance信息写入数据库
            await statOrderService.saveCoinMmBalance({
                account,
                data: JSON.stringify(balMap),
            });

            // 将marginRatio信息写入数据库
            await statOrderService.saveCoinMmMarginRatio({
                account,
                data: JSON.stringify(marginRatioMap),
            });
        } catch (e) {
            console.error(e);
        }
        await sleep(120 * 1000);
    });
};

const main = async () => {
    const dExInfo = await exchangeClient.getDeliveryExchangeInfo();
    contractSizeMap = dExInfo.symbols
        .filter((item) => item.contractStatus == "TRADING")
        .reduce((dContMap, item) => {
            dContMap[item.symbol] = item.contractSize;
            return dContMap;
        }, {});

    exchangeClient.pmInitWsEventHandler({
        orders: orderUpdateHandler,
    });
    exchangeClient.wsPmUserData();

    scheduleStatProfit();
};
main();
