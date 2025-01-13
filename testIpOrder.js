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

// const ipArr = [
//     '172.31.16.148', '172.31.16.149', '172.31.16.150', '172.31.16.151', '172.31.16.152', '172.31.16.153', '172.31.16.154', '172.31.16.155', '172.31.16.156', '172.31.16.157',
//     '172.31.16.158', '172.31.16.159', '172.31.16.160', '172.31.16.161']
const ipArr = [
    "172.31.16.158",
    "172.31.16.159",
    "172.31.16.160",
    "172.31.16.161",
];
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
    let options = {
        keyIndex,
        localAddress: configs.binanceLocalAddress[account],
        intranet,
    };
    const exchangeClient = new BinanceClient(options);
    exchangeClient.initWsEventHandler({
        orders: orderUpdateHandler,
        positions: positionUpdateHandler,
    });
    exchangeClient.wsFuturesUserData();

    for (let ip of ipArr) {
        console.log(ip);
        let options = {
            keyIndex,
            localAddress: ip,
            intranet,
        };
        const orderClient = new BinanceClient(options);
        const clientOrderId = genClientOrderId();
        const start = Date.now();
        // 下单
        console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
        const result = await orderClient.placeFuturesOrder(
            "BUY",
            symbol,
            20,
            0.4,
            {
                newClientOrderId: clientOrderId,
            }
        );
        console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
        //console.log(result);
        // console.log(`NEW ${Date.now()-start}`)
        await sleep(500);
        // 撤单
        console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
        await orderClient.cancelFuturesOrder(symbol, clientOrderId);
        console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
        await sleep(500);
    }
    process.exit();
};
main();
