const Binance = require("node-binance-api");
const { v4: uuidv4 } = require("uuid");
const { sleep } = require("../utils/run");

// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();

const apiKeyArr = process.env.BINANCE_API_KEY.split(",");
const apiSecretArr = process.env.BINANCE_API_SECRET.split(",");

class BinanceClient {
    constructor(options = {}) {
        let default_options = {
            family: 4,
            useServerTime: true,
            recvWindow: 10000,
        };
        if (options.proxy) {
            default_options["proxy"] = options.proxy;
        }

        if (options.localAddress) {
            default_options["localAddress"] = options.localAddress;
        }

        let keyIndex = 0;
        if (options.keyIndex) {
            keyIndex = options.keyIndex;
        }

        default_options["APIKEY"] = apiKeyArr[keyIndex];
        default_options["APISECRET"] = apiSecretArr[keyIndex];

        // 初始化Binance client
        this.client = new Binance().options(default_options);
    }

    initWsEventHandler(handlers) {
        this.handlers = handlers;
    }

    async futuresInstruments() {
        const result = await this.client.futuresExchangeInfo();
        return result.symbols.filter((item) => {
            return (
                ![
                    "USDC",
                    "BUSD",
                    "DAI",
                    "SRM",
                    "HNT",
                    "TOMO",
                    "CVC",
                    "BTS",
                    "SC",
                    "RAY",
                    "FTT",
                    "COCOS",
                    "STRAX",
                ].includes(item.baseAsset) &&
                ![
                    "CTKUSDT",
                    "DGBUSDT",
                    "ANTUSDT",
                    "BLUEBIRDUSDT",
                    "FOOTBALLUSDT",
                ].includes(item.symbol) &&
                item.contractType == "PERPETUAL" &&
                item.quoteAsset == "USDT"
            );
        });
    }

    async spotInstruments() {
        const result = await this.client.exchangeInfo();
        return result.symbols.filter((item) => {
            return (
                item.quoteAsset == "USDT" &&
                ![
                    "USDC",
                    "BUSD",
                    "DAI",
                    "SRM",
                    "HNT",
                    "TOMO",
                    "CVC",
                    "BTS",
                    "SC",
                    "RAY",
                    "FTT",
                    "COCOS",
                    "STRAX",
                ].includes(item.baseAsset)
            );
        });
    }

    async getFuturesSymbolConfigs() {
        let symbolConfigs = {};
        const result = await this.client.futuresExchangeInfo();
        for (let symbol of result.symbols) {
            if (
                symbol.contractType != "PERPETUAL" ||
                symbol.quoteAsset != "USDT" ||
                [
                    "USDC",
                    "BUSD",
                    "DAI",
                    "SRM",
                    "HNT",
                    "TOMO",
                    "CVC",
                    "BTS",
                    "SC",
                    "RAY",
                    "FTT",
                    "COCOS",
                    "STRAX",
                ].includes(symbol.baseAsset)
            ) {
                continue;
            }
            if (
                [
                    "CTKUSDT",
                    "DGBUSDT",
                    "ANTUSDT",
                    "BLUEBIRDUSDT",
                    "FOOTBALLUSDT",
                    "BTCUSDT",
                    "ETHUSDT",
                ].includes(symbol.symbol)
            ) {
                continue;
            }
            const lotSizeFilter = symbol.filters.find(
                (filter) => filter.filterType === "LOT_SIZE"
            );
            symbolConfigs[symbol.symbol] = {
                minTicker: parseFloat(lotSizeFilter.stepSize),
            };
        }
        return symbolConfigs;
    }

    // 获取指定symbols的open中的order list
    async getFuturesOpenOrderList() {
        const orders = await this.client.futuresOpenOrders();
        if (orders == null || orders.length == 0) {
            return [];
        }

        return orders.filter((item) => item.status == "NEW");
    }

    // 将position格式化成标准输出
    _formatPositions(positions) {
        let stdPositions = [];
        for (let item of positions) {
            let pos;
            if (item["positionAmt"] !== undefined) {
                // api 更新
                pos = {
                    symbol: item.symbol,
                    unrealizedProfit: parseFloat(item.unrealizedProfit),
                    positionAmt: parseFloat(item.positionAmt),
                    entryPrice: parseFloat(item.entryPrice),
                };
            } else {
                // ws 更新
                pos = {
                    symbol: item.symbol,
                    unrealizedProfit: parseFloat(item.unrealizedPnL),
                    positionAmt: parseFloat(item.positionAmount),
                    entryPrice: parseFloat(item.entryPrice),
                };
            }
            stdPositions.push(pos);
        }
        return stdPositions;
    }

    // 获取futures account的信息
    async getPositions() {
        const account = await this.client.futuresAccount();
        if (account == null) {
            return null;
        }

        // 更新positions
        let positions = account.positions;
        if (positions == null || positions.length == 0) {
            return null;
        }
        return this._formatPositions(positions);
    }

    async getPositionsWithoutFormat() {
        const account = await this.client.futuresAccount();
        if (account == null) {
            return null;
        }

        // 更新positions
        let positions = account.positions;
        if (positions == null || positions.length == 0) {
            return [];
        }
        return positions;
    }

    async getFuturesBalances() {
        return await this.client.futuresBalance();
    }

    async getTradingAccountBalance() {
        let b = 0;
        const res = await this.client.futuresAccount();
        if (res) {
            b = parseFloat(res.totalWalletBalance);
        }
        return b;
    }

    async getFundingAccountBalances() {
        return await this.client.fundingBalance();
    }

    // 获取杠杆
    async getAllFuturesLeverage() {
        return await this.client.futuresLeverageBracket();
    }

    // 设置symbol的杠杆
    async setFuturesLeverage(symbol, leverage) {
        return await this.client.futuresLeverage(symbol, leverage);
    }

    async getMarginRatio() {
        try {
            let marginRatio = 0;
            const result = await this.client.futuresAccount();
            if (result != null) {
                console.log(
                    result["totalMarginBalance"],
                    result["totalMaintMargin"]
                );
                if (parseFloat(result["totalMarginBalance"]) == 0) {
                    marginRatio = parseFloat(result["totalMaintMargin"]);
                } else {
                    marginRatio =
                        parseFloat(result["totalMarginBalance"]) /
                        parseFloat(result["totalMaintMargin"]);
                }
            }
            return marginRatio;
        } catch (e) {
            console.error("getMarginRatio", e);
        }
    }

    genClientOrderId(cid = null, key = null) {
        if (cid == null) {
            if (key == null) {
                return `O-${uuidv4().replaceAll("-", "")}`;
            } else {
                return `O-${uuidv4().slice(0, -4).replaceAll("-", "")}-${key}`; // 为了确保满足交易所要求，这里截掉一部分uuid的长度
            }
        } else {
            // 传了cid，是用于通过open订单的cid生成close订单的cid，这里将O-替换成C-
            return cid.replaceAll("O-", "C-");
        }
    }

    async getFuturesTickers() {
        return await this.client.futuresQuote();
    }

    async placeSpotMarketOrder(side, symbol, quantity) {
        if (side.toUpperCase() == "BUY") {
            return await this.client.marketBuy(symbol, quantity);
        } else if (side.toUpperCase() == "SELL") {
            return await this.client.marketSell(symbol, quantity);
        }
    }

    async placeFuturesMarketOrder(side, symbol, quantity) {
        side = side.toUpperCase();
        if (side == "BUY") {
            return await this.client.futuresMarketBuy(symbol, quantity);
        } else if (side == "SELL") {
            return await this.client.futuresMarketSell(symbol, quantity);
        }
    }

    async placeFuturesOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.futuresNewOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    async batchPlaceFuturesOrders(orderList, isRateLimit = true) {
        orderList = orderList.map((order) => {
            order.quantity = order.quantity + "";
            order.price = order.price + "";
            return order;
        });
        const batchSize = 5;
        while (orderList.length > 0) {
            const batchParams = orderList.splice(0, batchSize);
            const result = await this.client.futuresMultipleOrders(batchParams);

            // 休眠一段时间，防止请求频率过快（根据 API 限制而定）
            await sleep(20);
        }
    }

    async modifyFuturesOrder(symbol, params) {
        return await this.client.futuresModify(symbol, params);
    }

    // 批量修改orders
    async batchModifyFuturesOrders(orderList) {
        orderList = orderList.map((order) => {
            order.quantity = order.quantity + "";
            order.price = order.price + "";
            return order;
        });
        // 修改通常要及时完成，这里先不做频率限制
        const batchSize = 5;
        while (orderList.length > 0) {
            const batchParams = orderList.splice(0, batchSize);
            await this.client.futuresModifyBatchOrders(batchParams);
            await sleep(20);
        }
    }

    async cancelFuturesOrder(symbol, clientOrderId) {
        return await this.client.futuresCancel(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    // 根据clientOrderId批量取消订单
    async batchCancelFuturesOrdersByCids(symbol, clientOrderIds) {
        // 取消通常要及时完成，这里先不做频率限制
        const batchSize = 10;
        while (clientOrderIds.length > 0) {
            const batchParams = clientOrderIds.splice(0, batchSize);

            await this.client.futuresCancelBatchOrders(symbol, {
                origClientOrderIdList: JSON.stringify(batchParams),
            });
            await sleep(20);
        }
    }

    async cancelAllSymbolsFuturesOrders(symbols) {
        if (symbols && symbols.length > 0) {
            for (let symbol of symbols) {
                this.client.futuresCancelAll(symbol);
            }
        }
    }

    async cancelAllFuturesOrders(symbol) {
        return await this.client.futuresCancelAll(symbol);
    }

    async get1HrTradingAmount(symbol) {
        const endTime = Date.now();
        const startTime = endTime - 3600 * 1000;
        const result = await this.client.futuresUserTrades(symbol, {
            startTime,
            endTime,
        });
        let totalQuoteQty = 0;
        if (result != null && result.length > 0) {
            result.forEach((item) => {
                totalQuoteQty += parseFloat(item.quoteQty);
            });
        }
        return totalQuoteQty;
    }

    async getTradingAmount(symbol, startTime, endTime) {
        const result = await this.client.futuresUserTrades(symbol, {
            startTime,
            endTime,
        });
        let totalQuoteQty = 0;
        if (result != null && result.length > 0) {
            result.forEach((item) => {
                totalQuoteQty += parseFloat(item.quoteQty);
            });
        }
        return totalQuoteQty;
    }

    async getTradingHistory(symbol, startTime, endTime) {
        return await this.client.futuresUserTrades(symbol, {
            startTime,
            endTime,
        });
    }

    async getSpotBalances() {
        const result = await this.client.account();
        return result ? result.balances : null;
    }

    async trasferAsset(fromAccount, toAccount, asset, amount) {
        let type;
        if (fromAccount == "Spot" && toAccount == "Futures") {
            type = 1; // spot -> futures
        } else if (fromAccount == "Futures" && toAccount == "Spot") {
            type = 2; // futures -> spot
        } else if (fromAccount == "Spot" && toAccount == "Delivery") {
            type = 3; // spot -> delivery
        } else if (fromAccount == "Delivery" && toAccount == "Spot") {
            type = 4; // delivery -> spot
        } else {
            return;
        }

        return await this.client.futuresTransferAsset(asset, amount, type);
    }

    async getPositionMode() {
        return await this.client.futuresPositionSideDual();
    }

    async setPositionMode(dualSidePosition) {
        return await this.client.futuresChangePositionSideDual(
            dualSidePosition
        );
    }

    async getAssetMargin() {
        return await this.client.futuresMultiAssetsMargin();
    }

    async setAssetMargin(multiAssetsMargin) {
        return await this.client.futuresChangeMultiAssetsMargin(
            multiAssetsMargin
        );
    }

    async getFuturesCommissionRate(symbol) {
        return await this.client.futuresCommissionRate(symbol);
    }

    // --------------------------- websocket ---------------------------
    // 将order格式化成标准输出
    _formatOrder(order) {
        const filledQuantity = parseFloat(order.orderLastFilledQuantity);
        const filledPrice = parseFloat(order.lastFilledPrice);
        return {
            symbol: order.symbol,
            clientOrderId: order.clientOrderId,
            side: order.side,
            originalPrice: order.originalPrice,
            originalQuantity: parseFloat(order.originalQuantity),
            filledQuantity: filledQuantity,
            filledNotional: filledQuantity * filledPrice,
            orderStatus: order.orderStatus,
            executionType: order.executionType,
            orderTime: order.orderTradeTime,
        };
        // {
        //     eventType: 'ORDER_TRADE_UPDATE',
        //     eventTime: 1690381280972,
        //     transaction: 1690381280968,
        //     order: {
        //       symbol: 'SUIUSDT',
        //       clientOrderId: 'web_IPXK5F68vyuia4VKBSBi',
        //       side: 'BUY',
        //       orderType: 'LIMIT',
        //       timeInForce: 'GTC',
        //       originalQuantity: '169.4',
        //       originalPrice: '0.590000',
        //       averagePrice: '0',
        //       stopPrice: '0',
        //       executionType: 'NEW',
        //       orderStatus: 'NEW',
        //       orderId: 1555953913,
        //       orderLastFilledQuantity: '0',
        //       orderFilledAccumulatedQuantity: '0',
        //       lastFilledPrice: '0',
        //       commissionAsset: 'USDT',
        //       commission: '0',
        //       orderTradeTime: 1690381280968,
        //       tradeId: 0,
        //       bidsNotional: '99.9459999',
        //       askNotional: '0',
        //       isMakerSide: false,
        //       isReduceOnly: false,
        //       stopPriceWorkingType: 'CONTRACT_PRICE',
        //       originalOrderType: 'LIMIT',
        //       positionSide: 'BOTH',
        //       closeAll: false,
        //       activationPrice: undefined,
        //       callbackRate: undefined,
        //       realizedProfit: '0'
        //     }
        //   }
    }

    // 订阅账户ws信息，主要是position和order的变化消息
    wsFuturesAccount() {
        const r = this.client.websockets.userFutureData(
            false,
            (event) => {
                if (event.eventType == "ACCOUNT_UPDATE") {
                    let positions = event.updateData.positions;
                    const stdPositions = this._formatPositions(positions);
                    this.handlers["positions"](stdPositions);

                    if (this.handlers["balances"] != null) {
                        let balances = event.updateData.balances;
                        this.handlers["balances"](balances);
                    }
                }
            },
            (event) => {
                if (event.eventType == "ORDER_TRADE_UPDATE") {
                    let order = event.order;
                    const stdOrder = this._formatOrder(order);
                    this.handlers["orders"]([stdOrder]);
                }
            }
        );
    }

    // 订阅bookticker消息
    async wsFuturesBookTicker(symbols) {
        for (let symbol of symbols) {
            this.client.futuresBookTickerStream(
                symbol,
                this.handlers["tickers"]
            );
            await sleep(50);
        }
    }
}
module.exports = BinanceClient;
