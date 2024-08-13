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
        const balances = await exchangeClient.pmGetBalance();
        console.log("Portfolio Margin Account Balance:");
        if (balances && balances.length > 0) {
            for (let bal of balances) {
                if (bal.balance != 0) {
                    noFb = false;
                    console.log(bal.asset, bal.totalWalletBalance);
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        console.log("Current Futures Postions:");
        const positions = await exchangeClient.pmGetUmPositions();
        let positionLen = 0;
        if (positions && positions.length > 0) {
            for (let pos of positions) {
                if (pos.positionAmt != 0) {
                    positionLen++;
                    console.log(
                        pos.symbol,
                        pos.positionAmt,
                        pos.unRealizedProfit
                    );
                }
            }
            console.log("position length:", positionLen);
        } else {
            console.log("No position");
        }
        console.log();

        console.log("Open Orders:");
        const openOrders = await exchangeClient.pmGetUmOpenOrders();
        if (openOrders && openOrders.length > 0) {
            for (let order of openOrders) {
                console.log(
                    order.symbol,
                    order.clientOrderId,
                    order.side,
                    order.price,
                    order.origQty
                );
            }
            console.log("orders length:", openOrders.length);
        } else {
            console.log("No orders");
        }

        const commissionRate = await exchangeClient.pmGetUmCommissionRate(
            "BTCUSDT"
        );
        console.log(
            `Commission Rate: ${commissionRate["makerCommissionRate"]}`
        );
    } catch (e) {
        console.error(e);
    }
};
main();
