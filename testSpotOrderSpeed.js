const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const BinanceClient = require("./clients/binance");
const symbol = "POLUSDT";
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

let { account, intranet } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node testTickerSpeed.js --account=xxx");
    process.exit();
}
intranet = intranet == "true" ? true : false;
const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
    intranet,
};
const exchangeClient = new BinanceClient(options);

const orderUpdateHandler = async (orders) => {
    for (let order of orders) {
        if (order.symbol != symbol) {
            continue;
        }
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        if (["NEW"].includes(order.orderStatus)) {
            console.log(
                `${clientOrderId} NEW ${order.orderTime} ${Date.now()}`
            );
        } else if (["CANCELED"].includes(order.orderStatus)) {
            console.log(
                `${clientOrderId} CANCELED ${order.orderTime} ${Date.now()}`
            );
        } else if (["EXPIRED"].includes(order.orderStatus)) {
            console.log(
                `${clientOrderId} EXPIRED ${order.orderTime} ${Date.now()}`
            );
        } else if (["FILLED"].includes(order.orderStatus)) {
            console.log(
                `${clientOrderId} FILLED ${order.orderTime} ${Date.now()}`
            );
        } else {
            //console.log(order)
        }
    }
};

const positionUpdateHandler = async (positions) => {
    // console.log(positions)
};

const balanceUpdateHandler = async (balances) => {
    // console.log(balances);
};

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const main = async () => {
    await exchangeClient.cancelAllSpotOrders("BNBUSDT");
    process.exit();

    // const result = await exchangeClient.getMarginOpenOrders(symbol)
    // console.log(result);process.exit();
    exchangeClient.initWsEventHandler({
        orders: orderUpdateHandler,
    });
    exchangeClient.wsSpotUserData();
    await sleep(2000);
    let limit = 1;
    let i = 0;
    scheduleLoopTask(async () => {
        try {
            if (i >= limit) {
                process.exit();
            }
            i++;
            const clientOrderId = genClientOrderId();
            const start = Date.now();
            // 下单
            // console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
            // await exchangeClient.placeSpotOrder("BUY", symbol, 30, 0.183, {
            //     newClientOrderId: clientOrderId,
            //     type: "LIMIT",
            //     timeInForce: "IOC"
            // });

            // // await exchangeClient.placeMarginOrder("BUY", "BNBUSDT", 0.1, 586.9, {
            // //     newClientOrderId: clientOrderId,
            // // });

            // console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
            // //console.log(`NEW ${Date.now()-start}`)
            // await sleep(2000);

            // // 撤单
            // console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
            //await exchangeClient.cancelMarginOrder(symbol, clientOrderId);
            // console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
            //await sleep(2000);
            //process.exit();
        } catch (e) {
            console.error(e);
        }
    });
};
main();
