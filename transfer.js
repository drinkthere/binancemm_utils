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

const transferAsset = async () => {
    const asset = "BNB";
    const amount = 1;
    const result = await exchangeClient.trasferAsset(
        "Spot",
        "Futures",
        asset,
        amount
    );
    console.log(result);
};

const universalTransfer = async () => {
    // MAIN_UMFUTURE 现货钱包转向U本位合约钱包
    // MAIN_CMFUTURE 现货钱包转向币本位合约钱包
    // MAIN_MARGIN 现货钱包转向杠杆全仓钱包
    // UMFUTURE_MAIN U本位合约钱包转向现货钱包
    // UMFUTURE_MARGIN U本位合约钱包转向杠杆全仓钱包
    // CMFUTURE_MAIN 币本位合约钱包转向现货钱包
    // MARGIN_MAIN 杠杆全仓钱包转向现货钱包
    // MARGIN_UMFUTURE 杠杆全仓钱包转向U本位合约钱包
    // MARGIN_CMFUTURE 杠杆全仓钱包转向币本位合约钱包
    // CMFUTURE_MARGIN 币本位合约钱包转向杠杆全仓钱包
    // ISOLATEDMARGIN_MARGIN 杠杆逐仓钱包转向杠杆全仓钱包
    // MARGIN_ISOLATEDMARGIN 杠杆全仓钱包转向杠杆逐仓钱包
    // ISOLATEDMARGIN_ISOLATEDMARGIN 杠杆逐仓钱包转向杠杆逐仓钱包
    // MAIN_FUNDING 现货钱包转向资金钱包
    // FUNDING_MAIN 资金钱包转向现货钱包
    // FUNDING_UMFUTURE 资金钱包转向U本位合约钱包
    // UMFUTURE_FUNDING U本位合约钱包转向资金钱包
    // MARGIN_FUNDING 杠杆全仓钱包转向资金钱包
    // FUNDING_MARGIN 资金钱包转向杠杆全仓钱包
    // FUNDING_CMFUTURE 资金钱包转向币本位合约钱包
    // CMFUTURE_FUNDING 币本位合约钱包转向资金钱包
    // MAIN_OPTION 现货钱包转向期权钱包
    // OPTION_MAIN 期权钱包转向现货钱包
    // UMFUTURE_OPTION U本位合约钱包转向期权钱包
    // OPTION_UMFUTURE 期权钱包转向U本位合约钱包
    // MARGIN_OPTION 杠杆全仓钱包转向期权钱包
    // OPTION_MARGIN 期权全仓钱包转向杠杆钱包
    // FUNDING_OPTION 资金钱包转向期权钱包
    // OPTION_FUNDING 期权钱包转向资金钱包
    // MAIN_PORTFOLIO_MARGIN 现货钱包转向统一账户钱包
    // PORTFOLIO_MARGIN_MAIN 统一账户钱包转向现货钱包
    // MAIN_ISOLATED_MARGIN 现货钱包转向逐仓账户钱包
    // ISOLATED_MARGIN_MAIN 逐仓钱包转向现货账户钱包
    const type = "MAIN_UMFUTURE";
    const asset = "USDT";
    const amount = 45;
    const result = await exchangeClient.universalTransfer(type, asset, amount);
    console.log(result);
};

const main = async () => {
    //transferAsset();
    await universalTransfer();
};
main();
