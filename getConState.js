const BinanceClient = require("./clients/binance");
const { v4: uuidv4 } = require("uuid");
const { sleep, fileExists, scheduleLoopTask } = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

const { account, symbol } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node cancel.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: "172.31.16.148", //configs.binanceLocalAddress[account],
    intranet: true,
};
const exchangeClient = new BinanceClient(options);

const getConState = async () => {
    try {
        const result = await exchangeClient.getConState();
        for (let conn of result.clientConnections) {
            if (conn.endpoint == "ws-fapi-mm") {
                //if (conn.endpoint == 'fstream-mm') {
                console.log(
                    conn.endpoint,
                    "connectionCount:",
                    conn.connectionCount
                );
                for (let ip of Object.keys(conn.ipConnections)) {
                    if (conn.ipConnections[ip] > 0) {
                        console.log(ip, conn.ipConnections[ip]);
                    }

                    // if (['18.176.194.115', '18.178.29.130', '18.182.192.205', '18.182.201.157',
                    //     '35.73.166.164', '3.115.205.55', '35.76.99.53', '52.195.253.112',
                    //     '52.199.36.168', '52.197.37.213',  '52.68.102.67', '52.68.102.67',
                    //     '54.150.236.178', '54.65.81.179', '57.182.12.105'].includes(ip)) {
                    //     console.log(ip, conn.ipConnections[ip])
                    // }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
};

const main = async () => {
    await getConState();
};
main();
