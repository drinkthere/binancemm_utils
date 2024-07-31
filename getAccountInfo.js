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
    localAddress: configs.okxLocalAddress[account],
};
const exchangeClient = new BinanceClient(options);

const main = async () => {
    try {
        const balances = await exchangeClient.getFuturesBalances();
        console.log("Trading Account Balance:");
        if (balances && balances.length > 0) {
            for (let bal of balances) {
                if (bal.balance != 0) {
                    console.log(bal.asset, bal.balance);
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        console.log("Futures Account Balance:");
        const fBalances = await exchangeClient.getFundingAccountBalances();
        if (fBalances && fBalances.length > 0) {
            for (let bal of fBalances) {
                if (bal.balance != 0) {
                    console.log(bal.asset, bal.balance);
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        console.log("Current Postions:");
        const positions = await exchangeClient.getPositions();
        if (positions && positions.length > 0) {
            for (let pos of positions) {
                console.log(pos.symbol, pos.positionAmt, pos.unrealizedProfit);
            }
            console.log("position length:", positions.length);
        } else {
            console.log("No position");
        }
        console.log();

        console.log("Open Orders:");
        const openOrders = await exchangeClient.getFuturesOpenOrderList();
        if (openOrders && openOrders.length > 0) {
            for (let order of openOrders) {
                console.log(
                    order.symbol,
                    order.clientOrderId,
                    order.side,
                    order.originalPrice,
                    order.originalQuantity
                );
            }
            console.log("orders length:", openOrders.length);
        } else {
            console.log("No orders");
        }

        const feeRate = await exchangeClient.getFeeRates("SWAP");
        console.log(`Fee Rate: ${feeRate[0]["makerU"]}`);
    } catch (e) {
        console.error(e);
    }
};
main();
