const BinanceClient = require("./clients/binance");
const { sleep, fileExists } = require("./utils/run");
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
        // enable BNB to pay for interest
        const eResult = await exchangeClient.enableBNBBurn("true", "true");
        console.log(eResult);
        // // test borrow
        // const bResult = await exchangeClient.marginBorrow('ETH', 0.00000001)
        // console.log(bResult)

        // // test repay
        // const rResult = await exchangeClient.marginRepay('ETH', 0.00000001)
        // console.log(rResult)
    } catch (e) {
        console.error(e);
    }
};
main();
