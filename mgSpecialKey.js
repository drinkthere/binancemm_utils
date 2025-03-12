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
const exchangeClient = new BinanceClient(options);
const ed25519 = configs.ed25519[account];

const main = async () => {
    // const result = await exchangeClient.listMarginApiKeys();
    // console.log(result)

    const ips = [
        "54.150.236.178",
        "57.182.12.105",
        "18.182.201.157",
        "18.182.192.205",
        "18.178.29.130",
        "18.176.194.115",
        "52.197.37.213",
        "52.68.102.67",
        "54.65.81.179",
    ];
    const result = await exchangeClient.createMarginApiKey(
        "ltp_mg_ed25519",
        ed25519.publicKey,
        ips.join(",")
    );
    console.log(result);

    // const result = await exchangeClient.editIPforMarginApiKey(ed25519.apiKey, ips.join(','));
    // console.log(result)
};
main();
