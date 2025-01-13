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
        // let res = await exchangeClient.getPositionSide();
        // console.log(res);

        const result = await exchangeClient.setPositionSide("false");
        console.log(result);
        await sleep(1000);
        res = await exchangeClient.getPositionSide();
        console.log(res);

        // let res = await exchangeClient.pmGetCmPositionSide();
        // console.log(res);

        // await exchangeClient.pmSetCmPositionSide("false");

        // await sleep(1000);
        // res = await exchangeClient.pmGetCmPositionSide();
        // console.log(res);
    } catch (e) {
        console.error(e);
    }
};
main();
