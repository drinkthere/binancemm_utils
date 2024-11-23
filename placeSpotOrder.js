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
    });
    exchangeClient.wsSpotUserData();
    scheduleLoopTask(async () => {
        try {
            const clientOrderId = genClientOrderId();
            const result = await exchangeClient.placeSpotOrder(
                "BUY",
                "ETHUSDT",
                0.5,
                "3027.7",
                {
                    type: "MARKET",
                    newClientOrderId: clientOrderId,
                }
            );
            console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
            console.log(result);
        } catch (e) {
            console.error(e);
        }

        process.exit();
    });
};
main();
