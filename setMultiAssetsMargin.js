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
    log("node getAccountInfo.js --account=xxx");
    process.exit();
}

const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const main = async () => {
    try {
        let res = await exchangeClient.getMultiAssetsMargin();
        console.log(res);

        await exchangeClient.setMultiAssetsMargin("true");
        await sleep(1000);
        const aft = await exchangeClient.getMultiAssetsMargin();
        console.log(aft);
    } catch (e) {
        console.error(e);
    }
};
main();
