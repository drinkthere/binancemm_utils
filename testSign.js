const BinanceClient = require("./clients/binance");
const { createPrivateKey, sign, createPublicKey, verify } = require("crypto");
const { scheduleLoopTask, sleep, fileExists } = require("./utils/run");
const { v4: uuidv4 } = require("uuid");
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
const keyPairs = configs.keyMap[account];
const apiSecret = keyPairs.apiSecret;

const privateKey = createPrivateKey({
    key: apiSecret,
    format: "pem",
    type: "pkcs8",
});

const query =
    "apiKey=fF1u29YTnrxqhxIRe7c9EyqekYsIP6vGuNOOZf4UzfLC2oOxCCYvZKreqglL8xVy&timestamp=1722945094386";
let signature = sign(null, Buffer.from(query), privateKey).toString("base64");
console.log(signature);
