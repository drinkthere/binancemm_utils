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
const initPosition = configs["spotInitPositions"][account];

// 初始化同步锁
const lock = new AsyncLock();

// 初始化stat order service
const statOrderService = new StatOrderService();
const tgService = new TgService();
let noOrders = 0;
let maxNoOrdersTimes = 5;
let spotAccount = account + "_spot";
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

                const msg = `${spotAccount} ${clientOrderId} ${symbol} ${side} ${order.orderStatus} ${amount}@${price} ${notional} maker:${maker}`;
                log(msg);

                // 将订单写入数据库
                await statOrderService.saveOrder(`tb_order_${spotAccount}`, {
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
            const mgAccount = await exchangeClient.getMarginAccount();
            const marginRatio = mgAccount.marginLevel;

            const tickersMap = await exchangeClient.getSpotTickers();

            const assets = [];
            mgAccount.userAssets.map((item) => {
                if (item.netAsset == 0) {
                    return;
                }

                item.initAsset = 0;
                if (initPosition) {
                    if (item.asset in initPosition) {
                        item.initAsset = initPosition[item.asset];
                    }
                }

                item.pos =
                    parseFloat(item.netAsset) - parseFloat(item.initAsset);
                if (item.asset == "USDT") {
                    item.notional = item.pos;
                } else {
                    item.notional =
                        item.pos * parseFloat(tickersMap[item.asset + "USDT"]);
                    console.log(item.asset, item.notional);
                }
                assets.push(item);
            });

            let usdtBalanceArr = assets
                .filter((item) => item.asset == "USDT")
                .map((item) => item.pos);

            const usdtBalance =
                usdtBalanceArr.length == 0 ? 0 : parseFloat(usdtBalanceArr[0]);

            let tradingBalance = assets.reduce((total, item) => {
                log(
                    `${item.asset} f:${item.free}, l:${item.locked}, b:${item.borrowed}, n:${item.netAsset}, i:${item.initAsset}, p:${item.pos}, usd:${item.notional}`
                );
                if (item.asset == "BNB") {
                    return total;
                }
                return total + item.notional;
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
                `usdtBalance=${usdtBalance}, tradingBalance=${tradingBalance}, fundingBalance=${fundingBalance}`
            );

            // 获取openorders数量
            let buyOrdersNum = 0;
            let sellOrdersNum = 0;
            const orders = await exchangeClient.getMarginOpenOrders();
            if (orders && orders.length > 0) {
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

            let notionalBTCETH = 0;
            let notionalOther = 0;
            let positionsNum = 0;
            if (assets.length > 0) {
                for (let assetInfo of assets) {
                    positionsNum++;
                    if (["ETH", "BTC"].includes(assetInfo.asset)) {
                        notionalBTCETH += assetInfo.notional;
                    } else if (!["USDT", "BNB"].includes(assetInfo.asset)) {
                        notionalOther += assetInfo.notional;
                    }
                }
            }
            const notionalAll = notionalBTCETH + notionalOther;
            let msg = `${spotAccount} USDTBalance=${usdtBalance.toFixed(
                2
            )}|PositionDeltaWithBTCETH=${notionalBTCETH.toFixed(
                2
            )}|PositionDeltaWithoutBTCETH$=${notionalOther.toFixed(
                2
            )}|PositionDeltaAll=${notionalAll.toFixed(
                2
            )}|PositionCount=${positionsNum}`;
            log(msg);

            // 将balance信息写入数据库
            // 将订单写入数据库
            await statOrderService.saveBalance({
                account: spotAccount,
                usdt_balance: usdtBalance.toFixed(2),
                trading_balance: tradingBalance.toFixed(2),
                funding_balance: fundingBalance.toFixed(2),
                btc_eth_delta: notionalBTCETH.toFixed(2),
                other_delta: notionalOther.toFixed(2),
                total_delta: notionalAll.toFixed(2),
                margin_ratio: marginRatio,
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
    exchangeClient.wsMarginUserData();

    scheduleStatProfit();
};
main();
