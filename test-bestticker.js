const zmq = require("zeromq");
const fs = require("fs");
const protobuf = require("protobufjs");
const { scheduleLoopTask, sleep } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const tickerIPC = "tcp://127.0.0.1:56001";
const tickerRoot = protobuf.loadSync("./proto/okxticker.proto");
const ticker = tickerRoot.lookupType("OkxTicker");

const subscribeArr = [];
const subscribeMsg = async () => {
    const subscriber = new zmq.Subscriber();
    subscriber.connect(tickerIPC);
    subscriber.subscribe("");

    for await (const [topic, msg] of subscriber) {
        messageHandler(topic);
    }
    subscribeArr.push(subscriber);
};

const messageHandler = (pbMsg) => {
    const message = ticker.decode(pbMsg);
    console.log(
        message.instID,
        message.instType,
        message.bestBid,
        message.bestAsk,
        message.eventTs.toNumber()
    );
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
