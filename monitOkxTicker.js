const zmq = require("zeromq");
const fs = require("fs");
const protobuf = require("protobufjs");
const { scheduleLoopTask, sleep } = require("./utils/run");
const { log } = require("./utils/log");
const TgService = require("./services/tg.js");
const tgBot = new TgService();

const ipc = "tcp://192.168.1.227:56001";
let lastAlertTime = 0;
const alertCooldown = 5 * 60 * 1000; // 5 minutes in milliseconds
const maxNotUpdateTime = 10000; // 10s
const pbRoot = protobuf.loadSync("./proto/okxticker.proto");
const root = pbRoot.lookupType("OkxTicker");

let lastUpdateTime = Date.now();

const sendAlert = (msg) => {
    const currentTime = Date.now();

    if (currentTime - lastAlertTime >= alertCooldown) {
        tgBot.sendMsg(msg);
        lastAlertTime = Date.now();
    }
};

const subscribeMsg = async () => {
    const sock = new zmq.Subscriber();
    sock.connect(ipc);
    sock.subscribe("");

    console.log("Subscriber connected and waiting for messages...");

    for await (const [msg] of sock) {
        const message = root.decode(msg);
        const currentTimestamp = Date.now();
        lastUpdateTime = currentTimestamp;
    }
};

const checkTimeouts = () => {
    scheduleLoopTask(async () => {
        try {
            await sleep(10 * 1000);
            let msg = "";
            const now = Date.now();
            if (now - lastUpdateTime > maxNotUpdateTime) {
                msg += `No message received for okx ticker for ${
                    (now - lastUpdateTime) / 1000
                }s\n`;
            }

            if (msg != "") {
                log(msg);
                sendAlert(msg);
            } else {
                log(`lastUpdateTime is ${lastUpdateTime}`);
            }
        } catch (e) {
            console.error(e);
        }
    });
};

const main = async () => {
    subscribeMsg();

    // 每 10 秒检查一次超时和延迟
    checkTimeouts();
};
main();
