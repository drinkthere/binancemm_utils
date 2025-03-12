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
    intranet: false,
    localAddress: configs.binanceLocalAddress[account],
    apiKey: configs.keyMap[account].apiKey,
    apiSecret: configs.keyMap[account].apiSecret,
    tradingWsUrl: "sTradingWsUrl",
    wsEndpoint: "wsSpotOrder",
};

const exchangeClient = new BinanceClient(options);

const symbol = "POLUSDT";
const quantity = "30";
const price = "0.21";

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

const positionUpdateHandler = async (positions) => {
    console.log(positions);
};

const balanceUpdateHandler = async (balances) => {
    console.log(balances);
};

const genClientOrderId = () => {
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
            balances: balanceUpdateHandler,
        });

        exchangeClient.wsMarginUserData();
        //exchangeClient.wsSpotUserData();
        exchangeClient.wsInitMgOrderConnection(orderCallback);
        await sleep(2000);

        let limit = 100;
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
            const result = exchangeClient.wsPlaceSpotOrder(
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
            await sleep(1000);
            // 撤单

            console.log(`${clientOrderId} CANCELSUBMIT ${Date.now()}`);
            await exchangeClient.wsCancelSpotOrder(symbol, clientOrderId);
            console.log(`${clientOrderId} CANCELSUBMITTED ${Date.now()}`);
            await sleep(2000);
            process.exit();
        });
    } catch (e) {
        console.error(e);
    }
};
main();
