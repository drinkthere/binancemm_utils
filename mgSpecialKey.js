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

const { account } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node cancel.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
console.log(options);
const exchangeClient = new BinanceClient(options);
const ed25519 = configs.ed25519[account];

const main = async () => {
    const result = await exchangeClient.listMarginApiKeys();
    console.log(result);
    process.exit();
    // const ips = [
    //     "54.150.236.178",
    //     "57.182.12.105",
    //     "18.182.201.157",
    //     "18.182.192.205",
    //     "18.178.29.130",
    //     "18.176.194.115",
    //     "52.197.37.213",
    //     "52.68.102.67",
    //     "54.65.81.179",

    //     "18.176.38.80",
    //     "52.194.168.101",
    //     "13.231.28.241",
    //     "54.65.247.255",
    //     "18.179.159.142",
    //     "57.181.83.253",
    //     "3.112.143.11",
    //     "18.182.177.198"
    // ];

    const ips = [
        "52.195.253.112",
        "18.178.121.93",
        "3.114.251.234",
        "52.195.102.169",
        "52.197.3.237",
        "52.69.150.55",
        "52.69.61.125",
        "54.199.187.15",
        "54.250.224.70",
        "54.64.231.43",
        "54.95.196.221",
    ];

    // const result = await exchangeClient.createMarginApiKey(
    //     "ltp_mg_ed25519",
    //     ed25519.publicKey,
    //     ips.join(",")
    // );
    // console.log(result);

    //const result = await exchangeClient.editIPforMarginApiKey(ed25519.apiKey, "52.195.253.112");

    // const result = await exchangeClient.editIPforMarginApiKey(ed25519.apiKey, ips.join(','));
    // console.log(result)
};
main();
