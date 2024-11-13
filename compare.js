const zmq = require("zeromq");
const fs = require("fs");
const protobuf = require("protobufjs");
const { scheduleLoopTask, sleep } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const TgService = require("./services/tg.js");
const { Console, time } = require("console");

const ipcB = "tcp://192.168.1.222:56001";
const ipcC = "tcp://192.168.14.120:56001";

const tickerRoot = protobuf.loadSync("./proto/okxticker.proto");
const ticker = tickerRoot.lookupType("OkxTicker");

const subscribeArr = [];
const subscribeMsg = async (key, sock) => {
    for await (const [topic, msg] of sock) {
        messageHandler(key, topic);
    }
};

const messageHandler = (key, pbMsg) => {
    const message = ticker.decode(pbMsg);
    if (message.instID.indexOf("BTC-USDT") != -1) {
        console.log(
            key,
            message.instType,
            message.bestBid,
            message.bestAsk,
            message.eventTs.toNumber(),
            Date.now()
        );
    }
};

const main = async () => {
    const bsock = new zmq.Subscriber();
    bsock.connect(ipcB);
    bsock.subscribe("");
    subscribeArr.push(bsock);
    subscribeMsg("sockb", bsock);

    const csock = new zmq.Subscriber();
    csock.connect(ipcC);
    csock.subscribe("");
    subscribeArr.push(csock);
    subscribeMsg("sockc", csock);
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
