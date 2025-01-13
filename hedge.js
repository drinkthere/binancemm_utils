const AsyncLock = require("async-lock");
const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const { log } = require("./utils/log");
const configs = require(cfgFile);

// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();
const apiKeyArr = process.env.BINANCE_API_KEY.split(",");
const apiSecretArr = process.env.BINANCE_API_SECRET.split(",");

const hedgeAccount = "trader18";
const keyIndex = configs.keyIndexMap[hedgeAccount];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[hedgeAccount],
};
const hedgeClient = new BinanceClient(options);

// 待对冲的账户
const bnAccounts = configs.bnAccounts;
const instIDs = [
    "JUPUSDT",
    "LDOUSDT",
    "LINKUSDT",
    "LTCUSDT",
    "MAGICUSDT",
    "MKRUSDT",
    "NEARUSDT",
    "NEIROUSDT",
    "NOTUSDT",
    "OPUSDT",
    "ORDIUSDT",
    "PEOPLEUSDT",
    "POLUSDT",
    "RDNTUSDT",
    "RENDERUSDT",
    "SANDUSDT",
    "STXUSDT",
    "SUSHIUSDT",
    "TIAUSDT",
    "UNIUSDT",
    "XTZUSDT",
    "YFIUSDT",
    "SOLUSDT",
    "TONUSDT",
    "DOGEUSDT",
    "XRPUSDT",
    "TRBUSDT",
    "SUIUSDT",
    "1INCHUSDT",
    "AAVEUSDT",
    "ADAUSDT",
    "AGLDUSDT",
    "ALGOUSDT",
    "APEUSDT",
    "APTUSDT",
    "ARUSDT",
    "ARBUSDT",
    "ATOMUSDT",
    "AVAXUSDT",
    "AXSUSDT",
    "BLURUSDT",
    "BNBUSDT",
    "BOMEUSDT",
    "COMPUSDT",
    "CRVUSDT",
    "DOTUSDT",
    "DYDXUSDT",
    "ENSUSDT",
    "EOSUSDT",
    "ETCUSDT",
];
const hedgeInstIDs = ["BTCUSDT", "ETHUSDT"];
// 初始化同步锁
const lock = new AsyncLock();
let clientMap = {};
let notionalAccountMap = {};
let hedgeNotionalMap = {};
let hedgeOrders = [];
let tickerMap = {};
let canOrder = 0; // 0停止挂单；1启动挂单；2hedge仓位太重停止挂单
const checkHedgeIntervalMs = 500;
const restUpdateNotionalMs = 2000;
const cancelOrderIntervalMs = 30000;
const minQtyPerOrderMap = {
    BTCUSDT: 0.002,
    ETHUSDT: 0.006,
};
const takerQtyPerOrderMap = {
    BTCUSDT: 0.05,
    ETHUSDT: 0.5,
};
const makerQtyPerOrderMap = {
    BTCUSDT: 0.05,
    ETHUSDT: 0.5,
};
const hedgeQtyPresion = 3;
const delta = 200000;
const takerDelta = 500000;
const main = async () => {
    await init();
    subscribePositionNTickerUpdate();

    // 定时使用Rest更新Postion
    schedulingRestUpdateNotional();

    // 等3s数据都加载好
    await sleep(3000);
    canOrder = 1;

    // 定时计算delta并对冲
    schedulingHedge();

    // 定时取消Maker挂单
    schedulingCancelOrder();
};

const init = async () => {
    for (let account of bnAccounts) {
        const keyIndex = configs.keyIndexMap[account];
        if (keyIndex == undefined) {
            console.error(`Invalid account ${account}`);
            process.exit();
        }

        const localAddress = configs.binanceLocalAddress[account];
        const apiKey = apiKeyArr[keyIndex];
        const apiSecret = apiSecretArr[keyIndex];
        if (apiKey == undefined || apiSecret == undefined) {
            console.error(`Invalid api key secrect ${account}`);
            process.exit();
        }

        let options = {
            keyIndex,
            localAddress: localAddress,
        };
        const client = new BinanceClient(options);
        clientMap[account] = client;

        const instPositionMap = {};
        for (let instID of instIDs) {
            instPositionMap[instID] = 0;
        }
        notionalAccountMap[account] = instPositionMap;
    }

    for (let instID of hedgeInstIDs) {
        hedgeNotionalMap[instID] = 0;
    }

    console.log("[init] client initialized");
    await restUpdateInstNotional();
    console.log("[init] position initialized");
};

const restUpdateInstNotional = async () => {
    // 更新普通账户的notional
    for (let account of Object.keys(clientMap)) {
        const client = clientMap[account];
        // 更新当前的position
        let positions = await client.getFuturesPositions();
        await updateNotional(account, positions);
        await sleep(50);
    }

    // 更新对冲账户的notional
    let positions = await hedgeClient.getFuturesPositions();
    await updateHedgeNotional(positions);
};

const createUpdateNotionalCallback = (account) => {
    return async (positions) => {
        await updateNotional(account, positions);
    };
};

const updateNotional = async (account, positions) => {
    if (positions && positions.length > 0) {
        await lock.acquire(account, async () => {
            for (let position of positions) {
                const instID = position.symbol;
                if (!instIDs.includes(instID)) {
                    continue;
                }
                notionalAccountMap[account][instID] = parseFloat(
                    position.notional
                );
            }
        });
    }
};

const updateHedgeNotional = async (positions) => {
    if (positions && positions.length > 0) {
        await lock.acquire(hedgeAccount, async () => {
            for (let position of positions) {
                const instID = position.symbol;

                // hedge account 只计算BTC和ETH的notional
                if (!hedgeInstIDs.includes(instID)) {
                    continue;
                }
                hedgeNotionalMap[instID] = parseFloat(position.notional);
            }
        });
    }
};

const subscribePositionNTickerUpdate = async () => {
    for (let account of Object.keys(clientMap)) {
        const client = clientMap[account];
        client.initWsEventHandler({
            positions: createUpdateNotionalCallback(account),
        });
        client.wsFuturesUserData();
        await sleep(100);
    }

    hedgeClient.initWsEventHandler({
        positions: updateHedgeNotional,
        tickers: tickerUpdate,
        orders: orderUpdate,
    });
    for (let instID of hedgeInstIDs) {
        hedgeClient.wsFuturesBookTicker(instID);
    }
    hedgeClient.wsFuturesUserData();
    console.log(
        "[registerEventHandler] positions and tickers event handler registered"
    );
};

const tickerUpdate = async (ticker) => {
    if (!ticker) {
        return;
    }

    const instID = ticker.symbol;
    await lock.acquire(instID, async () => {
        tickerMap[instID] = {
            bidPrice: parseFloat(ticker.bestBid),
            askPrice: parseFloat(ticker.bestAsk),
        };
    });
};

const orderUpdate = async (orders) => {
    for (let order of orders) {
        // 使用clientOrderId作为锁的key，避免并发引起的更新错误
        const clientOrderId = order.clientOrderId;
        await lock.acquire(clientOrderId, async () => {
            if (order.orderStatus == "NEW") {
                // 添加到列表中
                let notional = order.originalPrice * order.originalQuantity;
                notional = order.size == "BUY" ? notional : -notional;
                hedgeOrders.push({ clientOrderId, notional });
            } else if (order.orderStatus == "FILLED") {
                // 从orders列表中删除
                removeOrderById(clientOrderId);
            } else if (order.orderStatus == "CANCELED") {
                // 从orders列表中删除
                removeOrderById(clientOrderId);
            }
        });
    }
};

function removeOrderById(clientOrderId) {
    const index = hedgeOrders.findIndex(
        (order) => order.clientOrderId === clientOrderId
    );

    // 如果找到，删除该项
    if (index !== -1) {
        hedgeOrders.splice(index, 1);
    }
}

const schedulingRestUpdateNotional = async () => {
    scheduleLoopTask(async () => {
        try {
            restUpdateInstNotional();
        } catch (err) {
            console.error(err);
        }
        await sleep(restUpdateNotionalMs);
    });
};

const schedulingHedge = async () => {
    const limit = 3;
    let i = 0;
    scheduleLoopTask(async () => {
        try {
            // i++
            // if (i > limit) {
            //     canOrder = 0
            // }

            // 计算total delta
            const totalDelta = await calculateTotalDelta();

            // 计算需要对冲的数量
            const hedgeAmt = calHedgeAmt(totalDelta);
            log(`hedgeAmt = ${hedgeAmt}`);

            if (hedgeAmt == 0) {
                let msg = `No need to hedge, threshold=${delta} hedgeAmt=${hedgeAmt}`;
                log(msg);
            } else {
                // 对冲
                await hedge(hedgeAmt, isMakerHedge(totalDelta));
            }
        } catch (err) {
            console.error(err);
        }
        await sleep(checkHedgeIntervalMs);
    });
};

const calculateTotalDelta = async () => {
    let totalAccountNotional = 0;
    let totalHedgeAccountNotional = 0;
    let totalOrderNotional = 0;
    for (let account of bnAccounts) {
        let accountDetal = 0;
        await lock.acquire(account, async () => {
            for (let instID of instIDs) {
                accountDetal += notionalAccountMap[account][instID];
                totalAccountNotional += notionalAccountMap[account][instID];
            }
        });
        console.log(`Account Delta: ${account} ${accountDetal}`);
    }

    await lock.acquire(hedgeAccount, async () => {
        for (let instID of hedgeInstIDs) {
            totalHedgeAccountNotional += hedgeNotionalMap[instID];
        }
    });

    totalOrderNotional = calHedgeOrderNotional();

    const totalDelta =
        totalAccountNotional + totalHedgeAccountNotional + totalOrderNotional;
    log(
        `totalDelta(${totalDelta}) = totalAccountNotional(${totalAccountNotional}) + totalHedgeAccountNotional(${totalHedgeAccountNotional}) + totalOrderNotional=${totalOrderNotional}`
    );
    return totalDelta;
};

const calHedgeOrderNotional = () => {
    let totalOrderNotional = 0;
    for (let order of hedgeOrders) {
        totalOrderNotional += order.notional;
    }
    return totalOrderNotional;
};

const calHedgeAmt = (totalNotionalDelta) => {
    if (totalNotionalDelta < -delta) {
        return -delta - totalNotionalDelta;
    } else if (totalNotionalDelta >= -delta && totalNotionalDelta <= delta) {
        return 0;
    } else if (totalNotionalDelta > delta) {
        return delta - totalNotionalDelta;
    }
};

const hedge = async (hedgeAmt, isMakerHedge) => {
    // 随机选择是用ETH 还是 BTC来对冲，后面再做优化，把仓位也加进去一起算权重
    const instID = pickHedgeInstID();

    if (isMakerHedge) {
        // 正常使用maker单对冲
        await placeMakerOrderToHedge(instID, hedgeAmt);
    } else {
        // 判断当前持仓是不是已经超过了takerDelta，如果是的话，就用taker单对冲
        await placeTakerOrderToHedge(instID, hedgeAmt);
    }
};

const isMakerHedge = (totalDelta) => {
    if (Math.abs(totalDelta) > takerDelta) {
        return false;
    } else {
        return true;
    }
};

const pickHedgeInstID = () => {
    const randomIndex = Math.floor(Math.random() * hedgeInstIDs.length);
    const selectedValue = hedgeInstIDs[randomIndex];
    return selectedValue;
};

const placeTakerOrderToHedge = async (instID, hedgeAmt) => {
    if (canOrder != 1) {
        return;
    }

    const ticker = tickerMap[instID];
    let price = hedgeAmt > 0 ? ticker.bidPrice : ticker.askPrice;

    const hedgeQtyPerOrder = takerQtyPerOrderMap[instID];
    const hedgeAmtPerOrder = hedgeQtyPerOrder * price;

    let minHedgeAmt = minQtyPerOrderMap[instID] * price;
    if (Math.abs(hedgeAmtPerOrder) < minHedgeAmt) {
        let msg = `No need to hedge, threshold=${takerDelta} hedgeAmt=${hedgeAmt} ${instID} minHedgeAmt=${minHedgeAmt}`;
        log(msg);
    } else {
        let msg = `Start to hedge, threshold=${takerDelta} hedgeAmtPerOrder=${hedgeAmtPerOrder}`;
        log(msg);

        let clOrdId = uuidv4().slice(0, -6);
        if (hedgeAmt > 0) {
            // 挂单，此时hedgeAmt > 0， 所以要挂BUY单买入
            await hedgeClient.placeFuturesMarketOrder(
                "BUY",
                instID,
                hedgeQtyPerOrder,
                {
                    newClientOrderId: clOrdId.replace(/-/g, ""),
                }
            );
        } else {
            // 挂单，此时hedgeAmt < 0， 所以要挂SELL单卖出
            await hedgeClient.placeFuturesMarketOrder(
                "SELL",
                instID,
                hedgeQtyPerOrder,
                {
                    newClientOrderId: clOrdId.replace(/-/g, ""),
                }
            );
        }
    }
};

const placeMakerOrderToHedge = async (instID, hedgeAmt) => {
    if (canOrder != 1) {
        return;
    }

    const ticker = tickerMap[instID];
    const price = hedgeAmt > 0 ? ticker.bidPrice : ticker.askPrice;

    let hedgeQty = calculateOrderQty(Math.abs(hedgeAmt), price);
    hedgeQty = Math.min(hedgeQty, makerQtyPerOrderMap[instID]);

    let minHedgeQty = minQtyPerOrderMap[instID];
    if (hedgeQty < minHedgeQty) {
        const minHedgeAmt = minHedgeQty * price;
        let msg = `No need to hedge, threshold=${delta} hedgeAmt=${hedgeAmt} ${instID} minHedgeAmt=${minHedgeAmt}`;
        log(msg);
    } else {
        let hedgeAmtPerOrder = hedgeQty * price;
        let msg = `Start to hedge, threshold=${delta} ${instID} hedgeAmtPerOrder=${hedgeAmtPerOrder}`;
        log(msg);
        let clOrdId = uuidv4().slice(0, -6);
        if (hedgeAmt > 0) {
            // 挂单，此时hedgeAmt > 0， 所以要挂BUY单买入
            await hedgeClient.placeFuturesOrder(
                "BUY",
                instID,
                hedgeQty,
                price,
                {
                    newClientOrderId: clOrdId.replace(/-/g, ""),
                }
            );
        } else {
            // 挂单，此时hedgeAmt < 0， 所以要挂SELL单卖出
            await hedgeClient.placeFuturesOrder(
                "SELL",
                instID,
                hedgeQty,
                price,
                {
                    newClientOrderId: clOrdId.replace(/-/g, ""),
                }
            );
        }
    }
};

const calculateOrderQty = (hedgeAmtAbs, price) => {
    let qty = hedgeAmtAbs / price;
    return parseFloat(qty.toFixed(hedgeQtyPresion));
};

const stopProces = async () => {
    canOrder = 0;
    log("stop and exit");
    for (let instID of hedgeInstIDs) {
        await hedgeClient.cancelAllFuturesOrders(instID);
        await sleep(100);
    }
    await sleep(5000);
    process.exit();
};

const schedulingCancelOrder = async () => {
    scheduleLoopTask(async () => {
        // 取消挂单
        for (let instID of hedgeInstIDs) {
            await hedgeClient.cancelAllFuturesOrders(instID);
            await sleep(100);
        }
        await sleep(cancelOrderIntervalMs);
    });
};

process.env.TZ = "Asia/Hong_Kong";
process.on("SIGINT", async () => {
    stopProces();
});
main();
