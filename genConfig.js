const path = require("path");
const {
    getDecimals,
    deleteFilesInDirectory,
    writeStringToFile,
    fileExists,
} = require("./utils/run");

const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}

const BinanceClient = require("./clients/binance");
const binanceClient = new BinanceClient({
    APIKEY: "",
    APISECRET: "",
});
let trader1AltConfig = require("../bnmm/config/config-trader1-alt.json");
let trader2AltConfig = require("../bnmm/config/config-trader2-alt.json");
let trader3AltConfig = require("../bnmm/config/config-trader3-alt.json");
let trader14AltConfig = require("../bnmm/config/config-trader14-alt.json");
let trader15AltConfig = require("../bnmm/config/config-trader15-alt.json");
let trader16AltConfig = require("../bnmm/config/config-trader16-alt.json");
let trader17AltConfig = require("../bnmm/config/config-trader17-alt.json");
const { stringify } = require("querystring");
let binanceFuturesTickersMap = {};
let binanceFuturesConfigMap = {};
const directory = "./mm-config";
const uPerOrderMap = {
    "config-trader1-alt.json": 1000,
    "config-trader2-alt.json": 1000,
    "config-trader3-alt.json": 1000,
    "config-trader14-alt.json": 1000,
    "config-trader15-alt.json": 1000,
    "config-trader16-alt.json": 1000,
    "config-trader17-alt.json": 1000,
};
const firstOrderMargin = 0.0005; // 第一单距离最大（小forBid）价格的距离
const firstOrderRangePercent = 0.0005;
const gapSizePercent = 0.0005;
const forgivePercentMap = {
    "config-trader1-alt.json": 0.9988,
    "config-trader2-alt.json": 0.9989,
    "config-trader3-alt.json": 0.999,
    "config-trader14-alt.json": 0.9991,
    "config-trader15-alt.json": 0.9992,
    "config-trader16-alt.json": 0.9993,
    "config-trader17-alt.json": 0.9994,
};

const tickerShiftMap = {
    "config-trader1-alt.json": 0.000025,
    "config-trader2-alt.json": 0.000025,
    "config-trader3-alt.json": 0.000025,
    "config-trader14-alt.json": 0.000025,
    "config-trader15-alt.json": 0.00005,
    "config-trader16-alt.json": 0.00005,
    "config-trader17-alt.json": 0.00005,
};
const maxOrderNum = 3;
const farOrderNum = 5; // 比maxOrderNum大一点就可以，避免浪费api
const volatilityE = 0.75;
const volatilityD = 4;
const volatilityG = 2000;
const minimumTickerShiftMulti = 2; // 这里用的是倍数，不是原始配置文件中的绝对值，因为contractNum是计算出来的，所以用倍数比较好，相当于 2 * contractNumber
const maximumTickerShiftMulti = 8; // 这里用的是倍数，不是原始配置文件中的绝对值，因为contractNum是计算出来的，所以用倍数比较好，相当于 4 * contractNumber
const positionReduceFactorMulti = 2; // 这里用的是倍数，不是原始配置文件中的绝对值，因为contractNum是计算出来的，所以用倍数比较好，相当于 2 * contractNumber
const positionOffset = 0;
const maxContractNumMulti = 25; // 这里用的是倍数，不是原始配置文件中的绝对值，因为contractNum是计算出来的，所以用倍数比较好，相当于 100 * contractNumber
const breakEvenX = 0.03;
const buyRatioOffset = 0;
const sellRatioOffset = 0.0001;
const main = async () => {
    try {
        deleteFilesInDirectory(directory);
        await genBinanceFuturesTickersMap();
        await genBinanceFuturesMap();
        // for (let asset of Object.keys(binanceFuturesConfigMap)) {
        //     if (['OP', 'SOL', 'SUSHI', 'AVAX', 'CRV'].includes(asset)) {
        //         console.log(asset)
        //         // for(let filter of binanceFuturesConfigMap[asset].filters) {
        //         //     if (filter.filterType == 'PRICE_FILTER' || filter.filterType == 'LOT_SIZE') {
        //         //         console.log(filter)
        //         //     }
        //         // }
        //     }
        // }
        // process.exit();
        genConfigFile("config-trader1-alt.json", trader1AltConfig);
        genConfigFile("config-trader2-alt.json", trader2AltConfig);
        genConfigFile("config-trader3-alt.json", trader3AltConfig);
        genConfigFile("config-trader14-alt.json", trader14AltConfig);
        genConfigFile("config-trader15-alt.json", trader15AltConfig);
        genConfigFile("config-trader16-alt.json", trader16AltConfig);
        genConfigFile("config-trader17-alt.json", trader17AltConfig);
    } catch (e) {
        console.error(e);
    }
};

const genBinanceFuturesTickersMap = async () => {
    // binanceFuturesTickersMap = await binanceClient.getFuturesTickers();

    binanceSpotTickersMap = await binanceClient.getSpotTickers();
    for (let key of Object.keys(binanceSpotTickersMap)) {
        if (key.startsWith("10")) {
            console.log(`"${key}",`);
        }
    }
    process.exit();
};

const genBinanceFuturesMap = async () => {
    const result = await binanceClient.getFuturesExchangeInfo();
    const insts = result.symbols;
    // [Object: null prototype] {
    //     symbol: 'BTCUSDT',
    //     pair: 'BTCUSDT',
    //     contractType: 'PERPETUAL',
    //     deliveryDate: 4133404800000,
    //     onboardDate: 1569398400000,
    //     status: 'TRADING',
    //     maintMarginPercent: '2.5000',
    //     requiredMarginPercent: '5.0000',
    //     baseAsset: 'BTC',
    //     quoteAsset: 'USDT',
    //     marginAsset: 'USDT',
    //     pricePrecision: 2,
    //     quantityPrecision: 3,
    //     baseAssetPrecision: 8,
    //     quotePrecision: 8,
    //     underlyingType: 'COIN',
    //     underlyingSubType: [ 'PoW' ],
    //     triggerProtect: '0.0500',
    //     liquidationFee: '0.012500',
    //     marketTakeBound: '0.05',
    //     maxMoveOrderLimit: 10000,
    //     filters: [
    //       [Object: null prototype] {
    //         maxPrice: '4529764',
    //         filterType: 'PRICE_FILTER',
    //         minPrice: '556.80',
    //         tickSize: '0.10'
    //       },
    //       [Object: null prototype] {
    //         maxQty: '1000',
    //         stepSize: '0.001',
    //         filterType: 'LOT_SIZE',
    //         minQty: '0.001'
    //       },
    //       [Object: null prototype] {
    //         stepSize: '0.001',
    //         filterType: 'MARKET_LOT_SIZE',
    //         maxQty: '120',
    //         minQty: '0.001'
    //       },
    //       [Object: null prototype] {
    //         filterType: 'MAX_NUM_ORDERS',
    //         limit: 200
    //       },
    //       [Object: null prototype] {
    //         filterType: 'MAX_NUM_ALGO_ORDERS',
    //         limit: 10
    //       },
    //       [Object: null prototype] {
    //         notional: '100',
    //         filterType: 'MIN_NOTIONAL'
    //       },
    //       [Object: null prototype] {
    //         multiplierDown: '0.9500',
    //         multiplierDecimal: '4',
    //         multiplierUp: '1.0500',
    //         filterType: 'PERCENT_PRICE'
    //       }
    //     ],
    //     orderTypes: [
    //       'LIMIT',
    //       'MARKET',
    //       'STOP',
    //       'STOP_MARKET',
    //       'TAKE_PROFIT',
    //       'TAKE_PROFIT_MARKET',
    //       'TRAILING_STOP_MARKET'
    //     ],
    //     timeInForce: [ 'GTC', 'IOC', 'FOK', 'GTX', 'GTD' ]
    //   }
    for (let inst of insts) {
        const asset = inst.baseAsset;
        binanceFuturesConfigMap[asset] = inst;
    }
};

const genConfigFile = (filename, configs) => {
    const binanceInsts = configs["InstIDs"];
    const oldInstConfigs = configs["InstIDConfigs"];
    let instConfigs = {};
    for (let inst of binanceInsts) {
        const oldInstCfg = oldInstConfigs[inst];
        const asset = inst.slice(0, -4);
        const instInfo = binanceFuturesConfigMap[asset];
        const tickerInfo = binanceFuturesTickersMap[inst];
        const contractNum = calculateContractNum(
            uPerOrderMap[filename],
            instInfo,
            tickerInfo
        );
        const priceTickerSize = getInstPriceTickSize(instInfo);
        const qtyTickerSize = getInstQtyTickSize(instInfo);
        instConfigs[inst] = {
            ContractNum: contractNum,
            VolPerCont: 1,
            BaseAsset: asset,
            Leverage: 10,
            EffectiveNum: parseFloat(qtyTickerSize),
            Precision: oldInstCfg["Precision"],
            FirstOrderMargin: firstOrderMargin,
            FirstOrderRangePercent: firstOrderRangePercent,
            GapSizePercent: gapSizePercent,
            ForgivePercent: forgivePercentMap[filename],
            TickerShift: tickerShiftMap[filename],
            MaxOrderNum: maxOrderNum,
            FarOrderNum: farOrderNum,
            VolatilityE: volatilityE,
            VolatilityD: volatilityD,
            VolatilityG: volatilityG,
            MinimumTickerShift: minimumTickerShiftMulti * contractNum,
            MaximumTickerShift: maximumTickerShiftMulti * contractNum,
            PositionReduceFactor: positionReduceFactorMulti * contractNum,
            PositionOffset: positionOffset,
            MaxContractNum: maxContractNumMulti * contractNum,
            BreakEvenX: breakEvenX,
            BuyRatioOffset: buyRatioOffset,
            SellRatioOffset: sellRatioOffset,
        };
    }
    configs["InstIDConfigs"] = instConfigs;

    let formattedJSON = JSON.stringify(configs, null, 4);
    const filePath = path.join(directory, filename);
    writeStringToFile(filePath, formattedJSON);
    console.log(`config file ${filename} generated in ${directory}`);
};

function calculateContractNum(uPerOrder, instInfo, tickerInfo) {
    const price = tickerInfo.askPrice; // ask价格高一些，用高的价格计算
    let qty = uPerOrder / price;

    let stepSizeStr = "0";
    for (let filter of instInfo.filters) {
        if (filter.filterType == "LOT_SIZE") {
            stepSizeStr = filter.stepSize;
        }
    }
    if (stepSizeStr == "0") {
        console.error(`${instInfo.symbol} step size error`);
        console.error(instInfo);
        process.exit();
    }

    const stepSizeDecimalPlaces = stepSizeStr.includes(".")
        ? stepSizeStr.split(".")[1].length
        : 0;

    // 计算调整因子
    const factor = Math.pow(10, stepSizeDecimalPlaces);

    // 四舍五入 qty 到指定的小数位数
    qty = Math.round(qty * factor) / factor;

    // 四舍五入到 minSize 的整数倍
    const stepSize = parseFloat(stepSizeStr);
    qty = Math.floor(qty / stepSize) * stepSize; // 向下取整到最近的 stepSize 的整数倍

    // 确保 qty 至少为 minSize
    qty = Math.max(qty, stepSize);
    decimals = getDecimals(stepSizeStr);
    return parseFloat(qty.toFixed(decimals));
    // // 如果 qty 是整数，返回整数
    // return qty % 1 === 0 ? Math.floor(qty) : qty;
}

function getInstPriceTickSize(instInfo) {
    let priceTickSize = -1;
    for (let filter of instInfo.filters) {
        if (filter.filterType == "PRICE_FILTER") {
            priceTickSize = filter.tickSize;
        }
    }
    if (priceTickSize == -1) {
        console.error(`${instInfo.symbol} price ticker size error`);
        console.error(instInfo);
        process.exit();
    }
    return priceTickSize;
}

function getInstQtyTickSize(instInfo) {
    let qtyTickSize = -1;
    for (let filter of instInfo.filters) {
        if (filter.filterType == "LOT_SIZE") {
            qtyTickSize = filter.minQty;
        }
    }
    if (qtyTickSize == -1) {
        console.error(`${instInfo.symbol} qty ticker size error`);
        console.error(instInfo);
        process.exit();
    }
    return qtyTickSize;
}
main();
