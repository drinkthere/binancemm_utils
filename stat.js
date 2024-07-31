const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { log } = require("./utils/log");
const OkxClient = require("./clients/okx");
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

// 初始化同步锁
const lock = new AsyncLock();

// 初始化stat order service
const statOrderService = new StatOrderService();
const tgService = new TgService();
let noOrders = 0;
let maxNoOrdersTime = 5;

let volContractMap = {};
const loadVolContractInfo = async () => {
    let insts = await exchangeClient.getInstruments("SWAP");
    insts = insts.filter((item) => item.instID.indexOf("USDC") == -1);
    for (let inst of insts) {
        volContractMap[inst.instID] = parseFloat(inst.ctVal);
    }
};

const orderUpdateHandler = async (orders) => {
    for (let order of orders) {
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        await lock.acquire(clientOrderId, async () => {
            if (["FILLED"].includes(order.orderStatus)) {
                const symbol = order.symbol;
                if (!volContractMap.hasOwnProperty(symbol)) {
                    console.error(`${symbol}'s ctVal configuration is missing`);
                    return;
                }

                const side = order.side;
                const quantity = order.originalQuantity;
                const amount = quantity * parseFloat(volContractMap[symbol]);
                const price = order.lastFilledPrice;
                const notional = price * amount;

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
                .map((item) => item.balance);
            const usdtBalance =
                usdtBalanceArr.length == 0 ? 0 : usdtBalanceArr[0];

            let tradingBalance = balances.reduce((total, item) => {
                return total + parseFloat(item.notional);
            }, 0);

            const fundingBalanceArr =
                await exchangeClient.getFundingAccountBalances();
            let fundingBalance = fundingBalanceArr.reduce((total, item) => {
                return (
                    total +
                    parseFloat(item.balance) *
                        parseFloat(
                            tickersMap[item.asset + "-USDT-SWAP"]["bestBid"]
                        )
                );
            }, 0);
            log(
                `tradingBalance=${tradingBalance}, fundingBalance=${fundingBalance}`
            );

            const positions = await exchangeClient.getPositions();
            let notionalBTCETH = 0;
            let notionalOther = 0;
            let positionsNum = 0;
            if (positions != null) {
                for (let position of positions) {
                    positionsNum++;
                    if (
                        ["ETH-USDT-SWAP", "BTC-USDT-SWAP"].includes(
                            position.symbol
                        )
                    ) {
                        notionalBTCETH += position.notional;
                    } else {
                        notionalOther += position.notional;
                    }
                }
            }
            const notionalAll = notionalBTCETH + notionalOther;
            let msg = `${account} USDTBalance=${usdtBalance.toFixed(
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
            let marginRatio = await exchangeClient.getMarginRatio();
            marginRatio = marginRatio ? marginRatio : 0;

            // 获取openorders数量
            let buyOrdersNum = 0;
            let sellOrdersNum = 0;
            const orders = await exchangeClient.getFuturesOpenOrderList();
            if (orders && orders.length > 5) {
                for (let order of orders) {
                    if (order.side == "BUY") {
                        buyOrdersNum++;
                    } else {
                        sellOrdersNum++;
                    }
                }
                noOrders = 0;
                maxNoOrdersTime = 5;
            } else {
                noOrders++;
                if (noOrders >= maxNoOrdersTime) {
                    // 报警
                    tgService.sendMsg(`${account} orders numbers warning`);
                    noOrders = 0;
                    maxNoOrdersTime = 2 * maxNoOrdersTime;
                }
            }

            const ordersNum = buyOrdersNum + sellOrdersNum;
            console.log(
                `The num of open orders is ${ordersNum}(B:${buyOrdersNum}|S:${sellOrdersNum})`
            );

            // 将订单写入数据库
            await statOrderService.saveBalance({
                account,
                usdt_balance: usdtBalance.toFixed(2),
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
    await loadVolContractInfo();
    exchangeClient.initWsEventHandler({
        orders: orderUpdateHandler,
    });
    exchangeClient.wsFuturesOrders();

    scheduleStatProfit();
};
main();
