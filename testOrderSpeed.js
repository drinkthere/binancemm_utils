const AsyncLock = require("async-lock");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const BinanceClient = require("./clients/binance");
const symbol = "MATICUSDT";
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

let { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node testTickerSpeed.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const orderUpdateHandler = async (orders) => {
    for (let order of orders) {
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        if (["NEW"].includes(order.orderStatus) && order.symbol == symbol) {
            console.log(
                `${clientOrderId} NEW ${order.orderTime} ${Date.now()}`
            );
        } else if (
            ["CANCELED"].includes(order.orderStatus) &&
            order.symbol == symbol
        ) {
            console.log(
                `${clientOrderId} CANCELED ${order.orderTime} ${Date.now()}`
            );
        }
    }
};

const positionUpdateHandler = async (positions) => {};

const genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const main = async () => {
    exchangeClient.initWsEventHandler({
        orders: orderUpdateHandler,
        positions: positionUpdateHandler,
    });
    exchangeClient.wsFuturesUserData();
    scheduleLoopTask(async () => {
        const clientOrderId = genClientOrderId();
        const start = Date.now();
        // 下单
        console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
        const result = await exchangeClient.placeFuturesOrder(
            "BUY",
            symbol,
            20,
            0.45,
            {
                newClientOrderId: clientOrderId,
            }
        );
        console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
        //console.log(result)
        // console.log(`NEW ${Date.now()-start}`)
        await sleep(2000);
        // 撤单
        console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
        await exchangeClient.cancelFuturesOrder(symbol, clientOrderId);
        console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
        await sleep(2000);
        //process.exit();
    });
};
main();
