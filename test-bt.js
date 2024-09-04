const zmq = require("zeromq");
const fs = require("fs");
const protobuf = require("protobufjs");
const { scheduleLoopTask, sleep } = require("./utils/run.js");
const { log } = require("./utils/log.js");
const TgService = require("./services/tg.js");
const { hasUncaughtExceptionCaptureCallback } = require("process");

const maxNotUpdateTime = 10000; // 10s
const maxP99DelayTime = 50; // 35

const ipc = "tcp://127.0.0.1:57002";

const pbRoot = protobuf.loadSync("./proto/bnticker.proto");
const root = pbRoot.lookupType("BinanceTicker");

const subscribeArr = [];
const subscribeMsg = async () => {
    const sock = new zmq.Subscriber();

    // Connect to the publisher
    sock.connect(ipc);

    // Subscribe to all messages
    sock.subscribe("");

    console.log("Subscriber connected and waiting for messages...");

    // Receive messages
    for await (const [msg] of sock) {
        const message = root.decode(msg);
        console.log(
            message.updateID.toNumber(),
            message.eventTs.toNumber(),
            Date.now()
        );
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
