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

let options = {
    keyIndex,
    apiKey: configs.keyMap[account].apiKey,
    apiSecret: configs.keyMap[account].apiSecret,
    localAddress: configs.binanceLocalAddress[account],
    intranet,
    tradingWsUrl: intranet ? "ifTradingWsUrl" : "fTradingWsUrl",
    wsEndpoint: "wsFuturesOrder",
};

const exchangeClient = new BinanceClient(options);

const symbol = "POLUSDT";
const quantity = "40";
const price = "0.2";

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
        exchangeClient.initWsEventHandler({
            orders: orderUpdateHandler,
            positions: positionUpdateHandler,
        });
        exchangeClient.wsFuturesUserData();
        exchangeClient.wsInitOrderConnection(orderCallback);
        await sleep(2000);

        let limit = 1;
        let i = 0;
        scheduleLoopTask(async () => {
            if (i >= limit) {
                process.exit();
            }
            i++;
            const clientOrderId = genClientOrderId();
            const start = Date.now();
            // 下单
            console.log(`${clientOrderId} NEWSUBMIT ${Date.now()}`);
            const result = exchangeClient.wsPlaceOrder(
                symbol,
                "BUY",
                quantity,
                price,
                {
                    newClientOrderId: clientOrderId,
                }
            );
            console.log(`${clientOrderId} NEWSUBMITTED ${Date.now()}`);
            console.log(result);
            // console.log(`NEW ${Date.now()-start}`)
            await sleep(1000);
            // // 撤单
            console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
            await exchangeClient.wsCancelOrder(symbol, clientOrderId);
            console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
            await sleep(1000);
        });
    } catch (e) {
        console.error(e);
    }
};
main();
