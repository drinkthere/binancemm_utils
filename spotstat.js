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

                const msg = `${account} ${clientOrderId} ${symbol} ${side} ${order.orderStatus} ${amount}@${price}`;
                log(msg);

                // 将订单写入数据库
                await statOrderService.saveOrder(`tb_spot_order_${account}`, {
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
            // 这里计算usdt价值时，用现货价格
            const balances = await exchangeClient.getSpotBalances();
            const balMap = {};
            balances.map((item) => {
                const bal = parseFloat(item.free) + parseFloat(item.locked);
                if (bal > 0) {
                    balMap[item.asset] = bal;
                }
            });
            log("balMap:");
            console.log(balMap);

            // 获取openorders数量
            let buyOrdersNum = 0;
            let sellOrdersNum = 0;
            const orders = await exchangeClient.getSpotOpenOrders();
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

            // 将balance信息写入数据库
            await statOrderService.saveSpotBalance({
                account,
                data: JSON.stringify(balMap),
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
    exchangeClient.wsSpotUserData();

    scheduleStatProfit();
};
main();
