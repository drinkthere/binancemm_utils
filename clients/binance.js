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

        // 初始化Binance client
        default_options["APIKEY"] = apiKeyArr[keyIndex];
        default_options["APISECRET"] = apiSecretArr[keyIndex];

        this.client = new Binance().options(default_options);

        if (
            typeof options["apiKey"] != "undefined" &&
            options["apiKey"] != "" &&
            typeof options["APISECRET"] != "undefined" &&
            options["APISECRET"] != ""
        ) {
            default_options["APIKEY"] = options["apiKey"];
            default_options["APISECRET"] = options["apiSecret"];
            this.orderClient = new Binance().options(default_options);
        } else {
            this.orderClient = null;
        }

        // 下单ws
        this.orderWs = null;
    }

    initWsEventHandler(handlers) {
        this.handlers = handlers;
    }

    async getFuturesTickers() {
        return await this.client.futuresQuote();
    }

    async getSpotBalances() {
        const result = await this.client.account();
        return result ? result.balances : null;
    }

    async getFuturesBalances() {
        return await this.client.futuresBalance();
    }

    async getFundingAccountBalances() {
        return await this.client.fundingBalance();
    }

    async getFuturesPositions() {
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

    // 获取指定symbols的open中的order list
    async getFuturesOpenOrders() {
        const orders = await this.client.futuresOpenOrders();
        if (orders == null || orders.length == 0) {
            return [];
        }
        return orders.filter((item) => item.status == "NEW");
    }

    async getFuturesCommissionRate(symbol) {
        return await this.client.futuresCommissionRate(symbol);
    }

    async getMarginRatio() {
        try {
            let marginRatio = 0;
            const result = await this.client.futuresAccount();
            if (result != null) {
                if (parseFloat(result["totalMaintMargin"]) == 0) {
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

    async placeFuturesOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.futuresOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    async cancelFuturesOrder(symbol, clientOrderId) {
        return await this.client.futuresCancel(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    // 订阅账户ws信息，主要是position和order的变化消息
    wsFuturesUserData() {
        const r = this.client.websockets.userFutureData(
            false,
            (event) => {
                if (event.eventType == "ACCOUNT_UPDATE") {
                    let positions = event.updateData.positions;
                    if (this.handlers["positions"]) {
                        this.handlers["positions"](positions);
                    }

                    if (this.handlers["balances"] != null) {
                        let balances = event.updateData.balances;
                        this.handlers["balances"](balances);
                    }
                }
            },
            (event) => {
                if (event.eventType == "ORDER_TRADE_UPDATE") {
                    let order = event.order;
                    if (this.handlers["orders"]) {
                        const stdOrder = this._formatOrder(order);
                        this.handlers["orders"]([stdOrder]);
                    }
                }
            }
        );
    }

    _formatOrder(order) {
        const filledQuantity = parseFloat(order.orderLastFilledQuantity);
        const filledPrice = parseFloat(order.lastFilledPrice);
        return {
            symbol: order.symbol,
            clientOrderId: order.clientOrderId,
            side: order.side,
            originalPrice: order.originalPrice,
            originalQuantity: parseFloat(order.originalQuantity),
            lastFilledPrice: filledPrice,
            lastFilledQuantity: filledQuantity,
            lastFilledNotional: filledQuantity * filledPrice,
            orderStatus: order.orderStatus,
            executionType: order.executionType,
            orderTime: order.orderTradeTime,
        };
        // {
        //     eventType: 'ORDER_TRADE_UPDATE',
        //     eventTime: 1722504114187,
        //     transaction: 1722504114184,
        //     businessUnit: 'UM',
        //     order: {
        //       symbol: 'BTCUSDT',
        //       clientOrderId: 'web_c4bgQ9BsKyc4j3nTp6e5',
        //       side: 'BUY',
        //       orderType: 'LIMIT',
        //       timeInForce: 'GTC',
        //       originalQuantity: '0.002',
        //       originalPrice: '64000',
        //       averagePrice: '0',
        //       stopPrice: '0',
        //       executionType: 'NEW',
        //       orderStatus: 'NEW',
        //       orderId: 383538030784,
        //       orderLastFilledQuantity: '0',
        //       orderFilledAccumulatedQuantity: '0',
        //       lastFilledPrice: '0',
        //       commissionAsset: 'USDT',
        //       commission: '0',
        //       orderTradeTime: 1722504114184,
        //       tradeId: 0,
        //       bidsNotional: '128',
        //       askNotional: '0',
        //       isMakerSide: false,
        //       isReduceOnly: false,
        //       positionSide: 'LONG',
        //       realizedProfit: '0',
        //       activationPrice: undefined
        //     }
        // }
    }

    async umGetMarginRatio() {
        try {
            let marginRatio = 0;
            const result = await this.client.pmGetAccount();
            if (result != null) {
                // console.log(
                //     result["totalAvailableBalance"],
                //     result["accountMaintMargin"]
                // );
                if (parseFloat(result["accountMaintMargin"]) == 0) {
                    marginRatio = parseFloat(result["totalAvailableBalance"]);
                } else {
                    marginRatio =
                        parseFloat(result["totalAvailableBalance"]) /
                        parseFloat(result["accountMaintMargin"]);
                }
            }
            return marginRatio;
        } catch (e) {
            console.error("getMarginRatio", e);
        }
    }

    // 获取统一账户信息
    async pmGetAccount() {
        return await this.client.pmGetAccount();
    }

    // 获取统一账户的余额
    async pmGetBalance() {
        return await this.client.pmGetBalance();
    }

    // 获取统一账户的Um持仓
    async pmGetUmPositions() {
        return await this.client.pmGetUmPositions();
    }

    // 获取统一账户的Um 订单
    async pmGetUmOpenOrders() {
        return await this.client.pmGetUmOpenOrders();
    }

    // 获取统一账户的Um commission rate
    async pmGetUmCommissionRate(symbol) {
        return await this.client.pmGetUmCommissionRate(symbol);
    }

    // 获取统一账户的Um commission rate
    async pmPlaceUmOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.pmPlaceOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    async pmCancelOrder(symbol, clientOrderId) {
        return await this.client.pmCancelOrder(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    pmInitWsEventHandler(handlers) {
        this.pmHandlers = handlers;
    }

    wsPmUserData() {
        const r = this.client.websockets.userPmData(
            (event) => {
                if (event.eventType == "ACCOUNT_UPDATE") {
                    let positions = event.updateData.positions;
                    //const stdPositions = this._formatPositions(positions);
                    if (this.pmHandlers["positions"] != null) {
                        this.pmHandlers["positions"](positions);
                    }

                    if (this.pmHandlers["balances"] != null) {
                        let balances = event.updateData.balances;
                        this.pmHandlers["balances"](balances);
                    }
                }
            },
            (event) => {
                if (event.eventType == "ORDER_TRADE_UPDATE") {
                    let order = event.order;
                    if (this.pmHandlers["orders"] != null) {
                        const stdOrder = this._pmFormatOrder(order);
                        this.handlers["orders"]([stdOrder]);
                    }
                }
            }
        );
    }

    _pmFormatOrder(order) {
        const filledQuantity = parseFloat(order.orderLastFilledQuantity);
        const filledPrice = parseFloat(order.lastFilledPrice);
        return {
            symbol: order.symbol,
            clientOrderId: order.clientOrderId,
            side: order.side,
            originalPrice: order.originalPrice,
            originalQuantity: parseFloat(order.originalQuantity),
            lastFilledPrice: filledPrice,
            lastFilledQuantity: filledQuantity,
            lastFilledNotional: filledQuantity * filledPrice,
            orderStatus: order.orderStatus,
            executionType: order.executionType,
            orderTime: order.orderTradeTime,
        };
        // {
        //     eventType: 'ORDER_TRADE_UPDATE',
        //     eventTime: 1722504114187,
        //     transaction: 1722504114184,
        //     businessUnit: 'UM',
        //     order: {
        //       symbol: 'BTCUSDT',
        //       clientOrderId: 'web_c4bgQ9BsKyc4j3nTp6e5',
        //       side: 'BUY',
        //       orderType: 'LIMIT',
        //       timeInForce: 'GTC',
        //       originalQuantity: '0.002',
        //       originalPrice: '64000',
        //       averagePrice: '0',
        //       stopPrice: '0',
        //       executionType: 'NEW',
        //       orderStatus: 'NEW',
        //       orderId: 383538030784,
        //       orderLastFilledQuantity: '0',
        //       orderFilledAccumulatedQuantity: '0',
        //       lastFilledPrice: '0',
        //       commissionAsset: 'USDT',
        //       commission: '0',
        //       orderTradeTime: 1722504114184,
        //       tradeId: 0,
        //       bidsNotional: '128',
        //       askNotional: '0',
        //       isMakerSide: false,
        //       isReduceOnly: false,
        //       positionSide: 'LONG',
        //       realizedProfit: '0',
        //       activationPrice: undefined
        //     }
        // }
    }

    genClientOrderId() {
        return uuidv4().replace(/-/g, "");
    }

    wsDeliveryBookTicker() {
        const symbol = "BTCUSD_PERP";
        this.client.deliveryBookTickerStream(symbol, this.handlers["tickers"]);
    }

    wsFuturesBookTicker() {
        const symbol = "BTCUSDT";
        this.client.futuresBookTickerStream(symbol, this.handlers["tickers"]);
    }

    async wsInitFuturesOrderConnection(callback) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }
        this.orderWs = this.orderClient.websockets.initOrderWs(callback);
        await sleep(1000);
        if (this.orderWs != null) {
            this.orderClient.websockets.orderLogon(this.genClientOrderId());
        }
    }

    wsPlaceOrder(symbol, side, quantity, price, params = {}) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }

        const reqId = this.genClientOrderId();

        if (!params.hasOwnProperty("newClientOrderId")) {
            params["newClientOrderId"] = reqId;
        }
        this.orderClient.websockets.wsPlaceOrder(
            reqId,
            symbol,
            side,
            quantity,
            price,
            params
        );
    }

    wsCancelOrder(symbol, clientOrderId) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }
        const reqId = this.genClientOrderId();
        this.orderClient.websockets.wsCancelOrder(reqId, symbol, clientOrderId);
    }
}
module.exports = BinanceClient;
