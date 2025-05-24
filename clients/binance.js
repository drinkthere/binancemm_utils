const Binance = require("node-binance-api");
const { v4: uuidv4 } = require("uuid");
const { sleep } = require("../utils/run");

// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();

const apiKeyArr = process.env.BINANCE_API_KEY.split(",");
const apiSecretArr = process.env.BINANCE_API_SECRET.split(",");
const urlMap = {
    ifapi: "https://fapi-mm.binance.com/fapi/",
    ifstream: "wss://fstream-mm.binance.com/stream?streams=",
    ifstreamSingle: "wss://fstream-mm.binance.com/ws/",
    idapi: "https://dapi-mm.binance.com/dapi/",
    idstream: "wss://dstream-mm.binance.com/stream?streams=",
    idstreamSingle: "wss://dstream-mm.binance.com/ws/",
    fTradingWsUrl:
        "wss://ws-fapi.binance.com/ws-fapi/v1?returnRateLimits=false",
    ifTradingWsUrl:
        "wss://ws-fapi-mm.binance.com/ws-fapi/v1?returnRateLimits=false",
    sTradingWsUrl:
        "wss://ws-api.binance.com:443/ws-api/v3?returnRateLimits=false",
    dTradingWsUrl:
        "wss://ws-dapi.binance.com/ws-dapi/v1?returnRateLimits=false",
    dTradingWsUrl:
        "wss://ws-dapi-mm.binance.com/ws-dapi/v1?returnRateLimits=false",
};
class BinanceClient {
    constructor(options = {}) {
        let default_options = {
            family: 4,
            useServerTime: true,
            recvWindow: 10000,
        };
        if (typeof options["wsEndpoint"] != "undefined") {
            default_options["wsEndpoint"] = options["wsEndpoint"];
        }
        if (options.proxy) {
            default_options["proxy"] = options.proxy;
        }

        if (options.localAddress) {
            default_options["localAddress"] = options.localAddress;
        }

        if (options.intranet) {
            if (options.instType == "delivery") {
                default_options["urls"] = {
                    dapi: urlMap["idapi"],
                    dstream: urlMap["idstream"],
                    dstreamSingle: urlMap["idstreamSingle"],
                };
            } else {
                default_options["urls"] = {
                    fapi: urlMap["ifapi"],
                    fstream: urlMap["ifstream"],
                    fstreamSingle: urlMap["ifstreamSingle"],
                };
            }
        }
        this.wsUrl = urlMap[options["tradingWsUrl"]];
        let keyIndex = 0;
        if (options.keyIndex) {
            keyIndex = options.keyIndex;
        }

        if (typeof options.deliveryColo !== "undefined") {
            default_options["deliveryColo"] = options.deliveryColo;
        }

        // 初始化Binance client
        default_options["APIKEY"] = apiKeyArr[keyIndex];
        default_options["APISECRET"] = apiSecretArr[keyIndex];
        //console.log(default_options);
        this.client = new Binance().options({ ...default_options });

        if (
            typeof options["apiKey"] != "undefined" &&
            options["apiKey"] != "" &&
            typeof options["apiSecret"] != "undefined" &&
            options["apiSecret"] != ""
        ) {
            default_options["APIKEY"] = options["apiKey"];
            default_options["APISECRET"] = options["apiSecret"];
            //console.log(default_options);process.exit();
            this.orderClient = new Binance().options({ ...default_options });
        } else {
            this.orderClient = null;
        }

        // 下单ws
        this.orderWs = null;
    }

    initWsEventHandler(handlers) {
        this.handlers = handlers;
    }

    async ping() {
        return await this.client.futuresPing();
    }

    async getConState() {
        return await this.client.futuresConState();
    }

    async getResponseInfo() {
        return await this.client.getInfo();
    }

    async getSpotExchangeInfo() {
        return await this.client.exchangeInfo();
    }

    async getSpotTickers() {
        return await this.client.prices();
    }

    // 获取指定symbols的open中的order list
    async getSpotOpenOrders() {
        const orders = await this.client.openOrders();
        if (orders == null || orders.length == 0) {
            return [];
        }

        return orders.filter((item) => item.status == "NEW");
    }

    async getSpotCommissionRate() {
        const account = await this.client.account();
        return account.commissionRates.maker;
    }

    async placeSpotOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.order(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    wsSpotUserData() {
        const r = this.client.websockets.userData(
            (event) => {
                if (event.eventType == "outboundAccountPosition") {
                    if (this.handlers["balances"] != null) {
                        let balances = event.B;
                        standardBalances = this._formatBalances(balances);
                        this.handlers["balances"](standardBalances);
                    }
                } else if (event.e == "executionReport") {
                    if (this.handlers["orders"]) {
                        const stdOrder = this._formatSpotOrder(event);
                        this.handlers["orders"]([stdOrder]);
                    }
                }
            },
            (event) => {
                console.log("xxx");
                console.log(event);
                // if (event.eventType == "ORDER_TRADE_UPDATE") {
                //     let order = event.order;
                //     if (this.handlers["orders"]) {
                //         const stdOrder = this._formatOrder(order);
                //         this.handlers["orders"]([stdOrder]);
                //     }
                // }
            }
        );
    }

    _formatBalances(balances) {
        const ret = [];
        if (balances && balances.length > 0) {
            for (let bal of balances) {
                ret.push({
                    asset: bal.a,
                    free: parseFloat(bal.f),
                    locked: parseFloat(bal.l),
                });
            }
        }
        return ret;
    }

    _formatSpotOrder(order) {
        try {
            const filledQuantity = parseFloat(order.l);
            const filledPrice = parseFloat(order.L);
            return {
                symbol: order.s,
                clientOrderId: order.c,
                side: order.S,
                originalPrice: parseFloat(order.p),
                originalQuantity: parseFloat(order.q),
                lastFilledPrice: filledPrice,
                lastFilledQuantity: filledQuantity,
                lastFilledNotional: filledQuantity * filledPrice,
                orderStatus: order.X,
                executionType: order.x,
                orderTime: order.T,
                isMaker: order.m ? 1 : 0,
            };
        } catch (e) {
            console.error(e);
        }
    }

    async getFuturesTickers() {
        return await this.client.futuresQuote();
    }

    async getSpotBalances() {
        const result = await this.client.account();
        return result ? result.balances : null;
    }

    async getFundingAccountBalances() {
        return await this.client.fundingBalance();
    }

    async getAccountStatus() {
        return await this.client.accountStatus();
    }

    async getFuturesBalances() {
        return await this.client.futuresBalance();
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

    async getFuturesMarginRatio() {
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

    async getFuturesExchangeInfo() {
        return await this.client.futuresExchangeInfo();
    }

    async getFuturesKline(symbol, interval = "30m", params = {}) {
        return await this.client.futuresCandles(symbol, interval, params);
    }

    async getDeliveryAccount() {
        return await this.client.deliveryAccount();
    }

    async getDeliveryExchangeInfo() {
        return await this.client.deliveryExchangeInfo();
    }

    async getDeliveryKline(symbol, interval = "30m", params = {}) {
        return await this.client.deliveryCandles(symbol, interval, params);
    }

    async getDeliveryTickers() {
        return await this.client.deliveryQuote();
    }

    async getDeliveryBalances() {
        return await this.client.deliveryBalance();
    }

    async getDeliveryPositions() {
        const account = await this.client.deliveryAccount();
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
    async getDeliveryOpenOrders() {
        const orders = await this.client.deliveryOpenOrders();
        if (orders == null || orders.length == 0) {
            return [];
        }
        return orders.filter((item) => item.status == "NEW");
    }

    async getDeliveryCommissionRate(symbol) {
        return await this.client.deliveryCommissionRate(symbol);
    }

    async getDeliveryMarginRatio() {
        try {
            const result = await this.client.deliveryAccount();
            return result.assets.filter(
                (item) => parseFloat(item.walletBalance) != 0
            );
        } catch (e) {
            console.error("getMarginRatio", e);
        }
    }

    async cancelAllDeliveryOrders(symbol) {
        return await this.client.deliveryCancelAll(symbol);
    }

    async getFuturesOrderRateLimit() {
        try {
            return await this.client.futuresOrderRateLimit();
        } catch (e) {
            console.error("getMarginRatio", e);
        }
    }

    async placeFuturesMarketOrder(side, symbol, quantity, params) {
        side = side.toUpperCase();
        return await this.client.futuresOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            false,
            params
        );
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

    async cancelAllFuturesOrders(symbol) {
        return await this.client.futuresCancelAll(symbol);
    }

    async cancelFuturesOrder(symbol, clientOrderId) {
        return await this.client.futuresCancel(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    async cancelAllSpotOrders(symbol) {
        return await this.client.cancelAll(symbol);
    }

    async getPositionSide() {
        return await this.client.futuresPositionSideDual();
    }

    async setFuturesPositionSide(dual) {
        return await this.client.futuresChangePositionSideDual(dual);
    }

    async setDeliveryPositionSide(dual) {
        return await this.client.deliveryChangePositionSideDual(dual);
    }

    async getMultiAssetsMargin() {
        return await this.client.futuresMultiAssetsMargin();
    }

    async setMultiAssetsMargin(multi) {
        return await this.client.futuresChangeMultiAssetsMargin(multi);
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
            },
            (event) => {
                if (event.eventType == "TRIDE_LITE") {
                    let order = event;
                    order.orderStatus = "FILLED";
                    order.executionType = "TRADE";
                    order.orderTradeTime = event.transactionTime;
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
            isMaker: order.isMakerSide ? 1 : 0,
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

    async placeDeliveryOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.deliveryOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
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

    async universalTransfer(type, asset, amount) {
        return await this.client.universalTransfer(
            type,
            asset,
            amount,
            console.log
        );
    }

    async cancelDeliveryOrder(symbol, clientOrderId) {
        return await this.client.deliveryCancel(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    async listMarginApiKeys() {
        return await this.client.mgListSpecialApiKeys();
    }

    async createMarginApiKey(
        apiName,
        publicKey,
        ip = "",
        permissionMode = "TRADE"
    ) {
        return await this.client.mgCreateSpecialApiKey(
            apiName,
            publicKey,
            ip,
            permissionMode
        );
    }

    async editIPforMarginApiKey(apiKey, ip) {
        return await this.client.mgEditIPForSpecialApiKey(apiKey, ip);
    }

    async getBNBBurn() {
        return await this.client.getBNBBurn();
    }

    async enableBNBBurn(spotBNBBurn, interestBNBBurn) {
        return await this.client.enableBNBBurn(spotBNBBurn, interestBNBBurn);
    }

    async getMarginAccount(isIsolated = false) {
        return await this.client.mgAccount((isIsolated = false));
    }

    async getMarginAllAssets() {
        return await this.client.mgAllAssets();
    }

    async transferDust(assets) {
        return await this.client.dustTransfer(assets, console.log);
    }

    async placeMarginOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.mgOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    async getMarginOpenOrders() {
        const orders = await this.client.mgOpenOrders();
        if (orders == null || orders.length == 0) {
            return [];
        }
        return orders.filter((item) => item.status == "NEW");
    }

    async cancelMarginOrder(symbol, clientOrderId) {
        return await this.client.mgCancelByCid(symbol, clientOrderId);
    }

    async cancelAllMarginOrders(symbol) {
        return await this.client.mgCancelOrders(symbol);
    }

    async marginBorrow(asset, amount) {
        return await this.client.mgBorrowRepay(asset, amount, "BORROW");
    }

    async marginRepay(asset, amount) {
        return await this.client.mgBorrowRepay(asset, amount, "REPAY");
    }

    wsDeliverUserData() {
        const r = this.client.websockets.userDeliveryData(
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

    wsMarginUserData() {
        this.client.websockets.userMarginData(
            (event) => {
                if (event.e == "outboundAccountPosition") {
                    if (this.handlers["positions"]) {
                        const positions = [];
                        if (event.B.length > 0) {
                            for (let bal of event.B) {
                                positions.push({
                                    asset: bal.a,
                                    free: parseFloat(bal.f),
                                    locked: parseFloat(bal.l),
                                });
                            }
                            this.handlers["positions"](positions);
                        }
                    }
                } else if (event.e == "balanceUpdate") {
                    if (this.handlers["balances"] != null) {
                        const balance = {
                            asset: event.a,
                            delta: parseFloat(event.d),
                            clearTime: event.T,
                        };
                        this.handlers["balances"]([balance]);
                    }
                }
            },
            (event) => {
                if (event.e == "executionReport") {
                    if (this.handlers["orders"]) {
                        const lastFilledPrice = parseFloat(event.L);
                        const lastFilledQuantity = parseFloat(event.l);
                        const clientOrderId = [
                            "NEW",
                            "EXPIRED",
                            "FILLED",
                        ].includes(event.X)
                            ? event.c
                            : event.C;
                        const order = {
                            symbol: event.s,
                            clientOrderId: clientOrderId,
                            side: event.S,
                            originalPrice: parseFloat(event.p),
                            originalQuantity: parseFloat(event.q),
                            lastFilledPrice: lastFilledPrice,
                            lastFilledQuantity: lastFilledQuantity,
                            lastFilledNotional:
                                lastFilledPrice * lastFilledQuantity,
                            orderStatus: event.X,
                            executionType: event.x,
                            orderTime: event.T,
                            isMaker: event.m ? 1 : 0,
                        };
                        this.handlers["orders"]([order]);
                    }
                }
            }
        );
    }

    async wsInitMgOrderConnection(callback) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }

        let params = {};
        if (this.wsUrl != "" && this.wsUrl != undefined) {
            params["wsUrl"] = this.wsUrl;
        }
        this.orderWs = this.orderClient.websockets.initOrderWs(
            callback,
            params
        );
        await sleep(1000);
        if (this.orderWs != null) {
            this.orderClient.websockets.orderLogon(this.genClientOrderId());
        }
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

    // 统一账户下U本位合约的订单
    async pmPlaceUmOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.pmPlaceUmOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    // 统一账户下U本位合约的订单
    async pmPlaceMgOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.pmPlaceUmOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    // 统一账户撤销U本位合约的订单
    async pmCancelUmOrder(symbol, clientOrderId) {
        return await this.client.pmCancelUmOrder(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    async pmCancelAllUmOrder(symbol) {
        return await this.client.pmCancelAllUmOrders(symbol);
    }

    async pmGetUmPositionSide() {
        return await this.client.pmUmPositionSideDual();
    }

    async pmSetUmPositionSide(dual) {
        return await this.client.pmUmChangePositionSideDual(dual);
    }

    // 获取统一账户的cm持仓
    async pmGetCmPositions() {
        return await this.client.pmGetCmPositions();
    }

    // 获取统一账户的Um 订单
    async pmGetCmOpenOrders() {
        return await this.client.pmGetCmOpenOrders();
    }

    // 获取统一账户的Um commission rate
    async pmGetCmCommissionRate(symbol) {
        return await this.client.pmGetCmCommissionRate(symbol);
    }

    // 统一账户下币本位合约的订单
    async pmPlaceCmOrder(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.pmPlaceCmOrder(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
    }

    // 统一账户撤销币本位合约的订单
    async pmCancelCmOrder(symbol, clientOrderId) {
        return await this.client.pmCancelCmOrder(symbol, {
            origClientOrderId: clientOrderId,
        });
    }

    async pmCancelAllCmOrder(symbol) {
        return await this.client.pmCancelAllCmOrders(symbol);
    }

    async pmGetCmPositionSide() {
        return await this.client.pmCmPositionSideDual();
    }

    async pmSetCmPositionSide(dual) {
        return await this.client.pmCmChangePositionSideDual(dual);
    }

    async pmProGetAccount() {
        return await this.client.pmProGetAccount();
    }

    async pmProGetBalance() {
        return await this.client.pmProGetBalance();
    }

    // 统一账户下U本位合约的订单
    async vipLoanBorrow(side, symbol, quantity, price, params) {
        side = side.toUpperCase();
        return await this.client.vipLoanBorrow(
            side.toUpperCase(),
            symbol,
            quantity,
            price,
            params
        );
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
                        this.pmHandlers["orders"]([stdOrder]);
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

    pmProInitWsEventHandler(handlers) {
        this.pmProHandlers = handlers;
    }

    wsPmProUserData() {
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
                        this.pmHandlers["orders"]([stdOrder]);
                    }
                }
            }
        );
    }

    genClientOrderId() {
        return uuidv4().replace(/-/g, "");
    }

    flexibleLoanOngoingOrders(
        loanCoin = "",
        collateralCoin = "",
        current = 1,
        limit = 10
    ) {
        const params = {};
        if (loanCoin != "") {
            params["loanCoin"] = loanCoin;
        }

        if (collateralCoin != "") {
            params["collateralCoin"] = collateralCoin;
        }

        if (current > 1) {
            params["current"] = current;
        }

        if (limit > 1) {
            params["limit"] = limit;
        }

        return this.client.flOngoingOrders(params);
    }

    flexibleLoanBorrow(
        loanCoin,
        collateralCoin,
        loanAmount = 0,
        collateralAmount = 0
    ) {
        const params = {};
        if (loanCoin == "" || collateralCoin == "") {
            console.error(
                `Both loanCoin=${loanCoin} and collateralCoin=${collateralCoin} should not be empty`
            );
            return;
        }

        if (loanAmount <= 0 && collateralAmount <= 0) {
            console.error(
                `loanAmount=${loanAmount} and collateralAmount=${collateralAmount} can't be <=0 at the same time`
            );
            return;
        }

        params["loanCoin"] = loanCoin;
        params["collateralCoin"] = collateralCoin;

        if (loanAmount > 0) {
            params["loanAmount"] = loanAmount;
        }

        if (collateralAmount > 0) {
            params["collateralAmount"] = collateralAmount;
        }

        return this.client.flBorrow(params);
    }

    wsDeliveryBookTicker() {
        const symbol = "BTCUSD_PERP";
        this.client.deliveryBookTickerStream(symbol, this.handlers["tickers"]);
    }

    wsFuturesBookTicker(symbol) {
        this.client.futuresBookTickerStream(symbol, this.handlers["tickers"]);
    }

    async wsInitOrderConnection(callback) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }

        let params = {};
        if (this.wsUrl != "" && this.wsUrl != undefined) {
            params["wsUrl"] = this.wsUrl;
        }

        this.orderWs = this.orderClient.websockets.initOrderWs(
            callback,
            params
        );
        await sleep(1000);
        if (this.orderWs != null) {
            this.orderClient.websockets.orderLogon(this.genClientOrderId());
        }
    }

    async wsInitSpotOrderConnection(callback) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }

        let params = {};
        if (this.wsUrl != "" && this.wsUrl != undefined) {
            params["wsUrl"] = this.wsUrl;
        }
        this.orderWs = this.orderClient.websockets.initOrderWs(
            callback,
            params
        );
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
        return this.orderClient.websockets.wsPlaceOrder(
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

    wsPlaceSpotOrder(symbol, side, quantity, price, params = {}) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }

        const reqId = this.genClientOrderId();

        if (!params.hasOwnProperty("newClientOrderId")) {
            params["newClientOrderId"] = reqId;
        }
        return this.orderClient.websockets.wsPlaceSpotOrder(
            reqId,
            symbol,
            side,
            quantity,
            price,
            params
        );
    }

    wsCancelSpotOrder(symbol, clientOrderId) {
        if (this.orderClient == null) {
            console.log("order client is not init");
            return;
        }
        const reqId = this.genClientOrderId();
        this.orderClient.websockets.wsCancelSpotOrder(
            reqId,
            symbol,
            clientOrderId
        );
    }
}
module.exports = BinanceClient;
