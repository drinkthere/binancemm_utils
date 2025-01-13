const BinanceClient = require("./clients/binance");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

let { account, intranet } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node getAccountInfo.js --account=xxx");
    process.exit();
}
intranet = intranet == "true" ? true : false;
const keyIndex = configs.keyIndexMap[account];
const ipArr = [
    "172.31.16.148",
    "172.31.16.149",
    "172.31.16.150",
    "172.31.16.151",
    "172.31.16.152",
    "172.31.16.153",
    "172.31.16.154",
    "172.31.16.155",
    "172.31.16.156",
    "172.31.16.157",
    "172.31.16.158",
    "172.31.16.159",
    "172.31.16.160",
    "172.31.16.161",
];

const symbol = "POLUSDT";
const quantity = "20";
const price = "0.45";

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

genClientOrderId = () => {
    return uuidv4().replace(/-/g, "");
};

const orderCallback = (result) => {
    //console.log(result)
};

const main = async () => {
    try {
        let options = {
            keyIndex,
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
                apiKey: configs.keyMap[account].apiKey,
                apiSecret: configs.keyMap[account].apiSecret,
                localAddress: ip,
                intranet,
            };
            const orderClient = new BinanceClient(options);
            orderClient.wsInitFuturesOrderConnection(orderCallback);
            await sleep(2000);
            const clientOrderId = genClientOrderId();
            const start = Date.now();
            // 下单
            console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
            const result = orderClient.wsPlaceOrder(
                symbol,
                "BUY",
                quantity,
                price,
                {
                    newClientOrderId: clientOrderId,
                }
            );
            console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
            //console.log(result)
            // console.log(`NEW ${Date.now()-start}`)
            await sleep(500);
            // // 撤单
            console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
            await orderClient.wsCancelOrder(symbol, clientOrderId);
            console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
            await sleep(500);
        }
        process.exit();
    } catch (e) {
        console.error(e);
    }
};
main();
