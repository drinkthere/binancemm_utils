const BinanceClient = require("./clients/binance");
const { sleep, fileExists } = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);

let { account, intranet } = require("minimist")(process.argv.slice(2));
if (account == null) {
    log("node getAccountInfo.js --account=xxx");
    process.exit();
}
intranet = intranet == "true" ? true : false;
const keyIndex = configs.keyIndexMap[account];

let options = {
    keyIndex,
    localAddress: configs.binanceLocalAddress[account],
    intranet,
};
const exchangeClient = new BinanceClient(options);

const main = async () => {
    try {
        // process.exit();

        // const rateLimit = await exchangeClient.getFuturesOrderRateLimit();
        // const limit1Min = rateLimit[0];
        // const limit10Sec = rateLimit[1];
        // console.log(
        //     `1 min limit ${limit1Min.limit}, 10 sec limit ${limit10Sec.limit}`
        // );
        //  const ei = await exchangeClient.getSpotExchangeInfo();
        //  const spotRateLimits = ei.rateLimits.filter(item => item.rateLimitType == "ORDERS" && item.interval == 'DAY')
        //  console.log(spotRateLimits);

        const balances = await exchangeClient.getFuturesBalances();
        let fbalanceLen = 0;
        console.log("Futures Balance:");
        if (balances && balances.length > 0) {
            for (let bal of balances) {
                if (bal.balance != 0) {
                    fbalanceLen++;
                    console.log(bal.asset, bal.balance);
                }
            }
            if (fbalanceLen == 0) {
                console.log(`No balance`);
            }
        } else {
            console.log(`No balance`);
        }

        console.log();

        const dbalances = await exchangeClient.getDeliveryBalances();
        let dbalanceLen = 0;
        console.log("Delivery Balance:");
        if (dbalances && dbalances.length > 0) {
            for (let bal of dbalances) {
                if (bal.availableBalance != 0) {
                    dbalanceLen++;
                    console.log(bal.asset, bal.availableBalance);
                }
            }
            if (dbalanceLen == 0) {
                console.log(`No balance`);
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        const sbalances = await exchangeClient.getSpotBalances();
        console.log("Spot Balance:");
        if (sbalances && sbalances.length > 0) {
            for (let bal of sbalances) {
                if (bal.free != 0 || bal.locked != 0) {
                    console.log(bal.asset, bal.free);
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        const fundingbalances =
            await exchangeClient.getFundingAccountBalances();
        console.log("Funding Account Balance:");
        if (fundingbalances && fundingbalances.length > 0) {
            for (let bal of fundingbalances) {
                if (bal.free != 0) {
                    console.log(bal.asset, bal.free);
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        console.log("Current Futures Postions:");
        const positions = await exchangeClient.getFuturesPositions();
        let positionLen = 0;
        if (positions && positions.length > 0) {
            for (let pos of positions) {
                if (pos.positionAmt != 0) {
                    positionLen++;
                    console.log(
                        pos.symbol,
                        pos.positionAmt,
                        pos.unrealizedProfit
                    );
                }
            }
            console.log("position length:", positionLen);
        } else {
            console.log("No position");
        }
        console.log();

        console.log("Futures Open Orders:");
        const openOrders = await exchangeClient.getFuturesOpenOrders();
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
        console.log();

        const fcommissionRate = await exchangeClient.getFuturesCommissionRate(
            "BTCUSDT"
        );
        console.log(
            `Futures Commission Rate: ${fcommissionRate["makerCommissionRate"]}`
        );
        console.log();

        let marginRatio = await exchangeClient.getFuturesMarginRatio();
        marginRatio = marginRatio ? marginRatio : 0;
        console.log("margin ratio", marginRatio);

        console.log("Current Delivery Postions:");
        const dPositions = await exchangeClient.getDeliveryPositions();
        let dPositionLen = 0;
        if (dPositions && dPositions.length > 0) {
            for (let pos of dPositions) {
                if (pos.positionAmt != 0) {
                    dPositionLen++;
                    console.log(
                        pos.symbol,
                        pos.positionAmt,
                        pos.unrealizedProfit
                    );
                }
            }
            console.log("position length:", dPositionLen);
        } else {
            console.log("No position");
        }
        console.log();

        console.log("Delivery Open Orders:");
        const dOpenOrders = await exchangeClient.getDeliveryOpenOrders();
        if (dOpenOrders && dOpenOrders.length > 0) {
            for (let order of dOpenOrders) {
                console.log(
                    order.symbol,
                    order.clientOrderId,
                    order.side,
                    order.price,
                    order.origQty
                );
            }
            console.log("orders length:", dOpenOrders.length);
        } else {
            console.log("No orders");
        }
        console.log();

        const dcommissionRate = await exchangeClient.getDeliveryCommissionRate(
            "BTCUSD_PERP"
        );
        console.log(
            `Delivery Commission Rate: ${dcommissionRate["makerCommissionRate"]}`
        );

        console.log("Spot Open Orders:");
        const spotOenOrders = await exchangeClient.getSpotOpenOrders();
        if (spotOenOrders && spotOenOrders.length > 0) {
            for (let order of spotOenOrders) {
                console.log(
                    order.symbol,
                    order.clientOrderId,
                    order.side,
                    order.price,
                    order.origQty
                );
            }
            console.log("orders length:", spotOenOrders.length);
        } else {
            console.log("No orders");
        }
        console.log();

        const spotCommistionRate = await exchangeClient.getSpotCommissionRate();
        console.log("spot comiistion rate", spotCommistionRate);
        console.log();

        const mgAccount = await exchangeClient.getMarginAccount();
        console.log("Margin Level:", mgAccount.marginLevel);
        console.log();

        console.log("Margin Balance:");
        if (mgAccount.userAssets && mgAccount.userAssets.length > 0) {
            for (let asset of mgAccount.userAssets) {
                if (
                    asset.free != "0" ||
                    asset.locked != "0" ||
                    asset.borrowed != "0" ||
                    asset.interest != "0"
                ) {
                    console.log(
                        asset.asset,
                        "f:" + asset.free,
                        "l:" + asset.locked,
                        "b:" + asset.borrowed,
                        "n:" + asset.netAsset,
                        "in:" + asset.interest
                    );
                }
            }
        } else {
            console.log(`No balance`);
        }
        console.log();

        console.log("Margin Open Orders:");
        const mgOpenOrders = await exchangeClient.getMarginOpenOrders();
        if (mgOpenOrders && mgOpenOrders.length > 0) {
            for (let order of mgOpenOrders) {
                console.log(
                    order.symbol,
                    order.clientOrderId,
                    order.side,
                    order.price,
                    order.origQty
                );
            }
            console.log("orders length:", mgOpenOrders.length);
        } else {
            console.log("No orders");
        }
        console.log();
    } catch (e) {
        console.error(e);
    }
};
main();
