const zmq = require("zeromq");
const fs = require("fs");
const protobuf = require("protobufjs");
const { scheduleLoopTask, sleep } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const TgService = require("./services/tg.js");
const { hasUncaughtExceptionCaptureCallback } = require("process");

const maxNotUpdateTime = 10000; // 10s
const maxP99DelayTime = 50; // 35
const ipcMap = {
    tickerIPC: "tcp://127.0.0.1:21002",
};

const pbRoot = protobuf.loadSync("./proto/newticker.proto");
const ticker = pbRoot.lookupType("TickerInfo");
// const tickerRoot = protobuf.loadSync("./proto/okxticker.proto");
// const ticker = tickerRoot.lookupType("OkxTicker");

// const orderBookRoot = protobuf.loadSync("./proto/okxorderbook.proto");
// const orderBook = orderBookRoot.lookupType("OkxOrderBook");

const subscribeArr = [];
const subscribeMsg = async () => {
    for (let key of Object.keys(ipcMap)) {
        const ipc = ipcMap[key];

        // const subscriber = zmq.socket("sub");
        // subscriber.connect(ipc);
        // subscriber.subscribe("");

        // subscriber.on("message", (pbMsg, foo) => {
        //     messageHandler(key, pbMsg);
        // });
        // subscribeArr.push(subscriber);

        const sock = new zmq.Subscriber();

        // Connect to the publisher
        sock.connect(ipc);

        // Subscribe to all messages
        sock.subscribe("");

        console.log("Subscriber connected and waiting for messages...");

        // Receive messages
        for await (const [msg] of sock) {
            const message = ticker.decode(msg);
            //console.log(message);
            console.log(message.instID, message.bestBid, message.bestAsk);
        }
    }
};

const messageHandler = (key, pbMsg) => {
    if (key == "tickerIPC") {
        const message = ticker.decode(pbMsg);
        console.log(
            message.instID,
            message.instType,
            message.bestBid,
            message.bestAsk,
            message.eventTs.toNumber()
        );
    } else if (key == "orderBookIPC") {
        const message = orderBook.decode(pbMsg);
        // console.log(
        //     message.instID,
        //     message.instType,
        //     message.asks.length,
        //     message.bids.length
        // );
        //console.log(currentTimeNs, message.bids[0].price, message.bids[0].size, message.asks[0].price, message.asks[0].size, message.updateTimeMs.toNumber())
        // if (message.asks.length <= 1 || message.bids.length <= 1) {
        //     console.log(message.instID, message.instType, message.asks, message.bids)
        // } else {
        //     console.log(message.instID, message.instType, message.asks.length, message.bids.length)
        // }
    }
};

const main = async () => {
    await subscribeMsg();
};
main();

// 当程序终止时关闭 ZMQ 套接字
process.on("SIGINT", () => {
    for (let sub of subscribeArr) {
        sub.close();
    }
    //fileStream.end();
    process.exit(0);
});
