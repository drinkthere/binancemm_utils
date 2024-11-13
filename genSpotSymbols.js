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
const configs = require(cfgFile);

const OkxClient = require("./clients/okx");
const BinanceClient = require("./clients/binance");
const keyIndex = 0;
const orderAmount = 100;
// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();
const apiKeyArr = process.env.OKX_STAT_API_KEY.split(",");
const apiSecretArr = process.env.OKX_STAT_API_SECRET.split(",");
const apiPasswordArr = process.env.OKX_STAT_API_PASSWORD.split(",");

let options = {
    API_KEY: apiKeyArr[keyIndex],
    API_SECRET: apiSecretArr[keyIndex],
    API_PASSWORD: apiPasswordArr[keyIndex],
};
const okxClient = new OkxClient(options);
const binanceClient = new BinanceClient({
    APIKEY: process.env.BINANCE_API_KEY,
    APISECRET: process.env.BINANCE_API_SECRET,
});
let okxFuturesConfigMap = {};
let bnFuturesAssetMap = {};
let referInstrumentsMap = {};
const directory = "./mm-config";
const accountArr = Object.keys(configs.keyIndexMap);

const firstOrderMarginArr = [
    0.00005, 0.00005, 0.00005, 0.00006, 0.00007, 0.00008, 0.0004, 0.0004,
    0.0004, 0.00005, 0.00005, 0.00005, 0.00005, 0.00005,
];

const firstOrderRangePercentArr = [
    0.00005, 0.00005, 0.00005, 0.00006, 0.00007, 0.00008, 0.0002, 0.0002,
    0.0002, 0.00005, 0.00005, 0.00005, 0.00005, 0.00005,
];

const gapSizePercentArr = [
    0.00025, 0.00025, 0.00025, 0.0003, 0.00035, 0.0004, 0.0015, 0.0015, 0.0015,
    0.00025, 0.00025, 0.00025, 0.00025, 0.00025,
];

const forgivePercentArr = [
    1, 1, 0.99995, 0.99995, 0.99995, 0.99995, 0.9995, 0.99925, 0.999, 1, 1,
    0.99995, 1, 1,
];

const tickerShiftArr = [
    0.0000025, 0.0000025, 0.0000025, 0.0000025, 0.0000025, 0.0000025, 0.000005,
    0.000005, 0.000005, 0.0000025, 0.0000025, 0.0000025, 0.0000025, 0.0000025,
];

const volatilityDArr = [3, 2, 2, 3, 3.5, 4, 1.8, 1.6, 1.4, 3, 2, 2, 3, 2];

const volatilityGArr = [
    60, 120, 240, 240, 240, 240, 300, 360, 420, 120, 180, 240, 120, 240,
];

const minimumTickershiftArr = [
    100, 100, 100, 50, 50, 50, 50, 50, 50, 100, 75, 50, 100, 50,
];

const maxPositionArr = [
    1000, 1000, 1000, 100, 1000, 1000, 1000, 1000, 1000, 1000, 2000, 2000, 2000,
    1000, 1000, 2000, 2000, 100,
];

const maxPositionMap = {
    CORE: 500,
    OTHER: 500,
};

const breakEvenXArr = [
    0.003, 0.003, 0.003, 0.003, 0.003, 0.003, 0.01, 0.01, 0.01, 0.003, 0.003,
    0.003, 0.003, 0.003,
];

let validInstIDs = [
    "BTC-USDT-SWAP",
    "ETH-USDT-SWAP",
    "MATIC-USDT-SWAP",
    "XRP-USDT-SWAP",
    "SOL-USDT-SWAP",
    "DOGE-USDT-SWAP",
    "1INCH-USDT-SWAP",
    "AAVE-USDT-SWAP",
    "ACH-USDT-SWAP",
    "ADA-USDT-SWAP",
    "ARB-USDT-SWAP",
    "ATOM-USDT-SWAP",
    "AVAX-USDT-SWAP",
    "BNB-USDT-SWAP",
    "CRV-USDT-SWAP",
    "DOT-USDT-SWAP",
    "DYDX-USDT-SWAP",
    "FTM-USDT-SWAP",
    "LINK-USDT-SWAP",
    "LTC-USDT-SWAP",
    "OP-USDT-SWAP",
    "UNI-USDT-SWAP",
    "NEAR-USDT-SWAP",
    "WIF-USDT-SWAP",
    "BCH-USDT-SWAP",
    "WLD-USDT-SWAP",
    "FIL-USDT-SWAP",
    "ORDI-USDT-SWAP",
    "ETC-USDT-SWAP",
    "RNDR-USDT-SWAP",
    "APT-USDT-SWAP",
    "TIA-USDT-SWAP",
];

const getOkxAssetsSet = async (instType) => {
    const insts = await okxClient.getInstruments(instType);
    let assetsSet = new Set();
    for (let inst of insts) {
        var asset;
        if (instType == "SWAP") {
            asset = inst.ctValCcy;
            okxFuturesConfigMap[inst.instID] = inst;
        } else {
            asset = inst.baseCcy;
        }
        assetsSet.add(asset);
    }
    return assetsSet;
};

const getBinanceAssetsSet = async (instType) => {
    var result;
    let assetSet = new Set();
    if (instType == "FUTURES") {
        // 获取binance支持的futures
        result = await binanceClient.futuresInstruments();
    } else if (instType == "SPOT") {
        result = await binanceClient.spotInstruments();
    }

    for (let item of result) {
        assetSet.add(item.baseAsset);
    }
    return assetSet;
};

const formatBinanceFuturesAssets = (bnFuturesAssets) => {
    let assetSet = new Set();
    for (let asset of bnFuturesAssets) {
        const formattedAsset = asset.replace("1000", "");
        bnFuturesAssetMap[formattedAsset] = asset;
        assetSet.add(formattedAsset);
    }
    return assetSet;
};

function calculateOrderSize(
    price,
    decimals,
    minSize,
    contractValue,
    contractTicker
) {
    // 格式化价格，保留小数位数
    const formattedPrice = parseFloat(price.toFixed(decimals));

    // 计算下单张数
    let targetOrderSize = orderAmount / (formattedPrice * contractValue);

    // 确保下单张数为最小变动的整数倍
    targetOrderSize =
        Math.round(targetOrderSize / contractTicker) * contractTicker;

    // 确保下单张数不低于最小合约下单张数
    targetOrderSize = Math.max(targetOrderSize, minSize);

    return targetOrderSize;
}

const main = async () => {
    try {
        // 获取okx 支持的spot
        const okxSpotAssets = await getOkxAssetsSet("SPOT");
        console.log(okxSpotAssets);
        process.exit();

        // 获取binance支持的futures
        let bnFuturesAssets = await getBinanceAssetsSet("FUTURES");
        bnFuturesAssets = formatBinanceFuturesAssets(bnFuturesAssets);
    } catch (e) {
        console.error(e);
    }
};
main();
