const main = async () => {
    await genConfig();
};

const genConfig = async () => {
    let assets = [
        "ETH",
        "SOL",
        "LINK",
        "DOGE",
        "AAVE",
        "ATOM",
        "AVAX",
        "FTM",
        "OP",
        "LTC",
    ];
    let assetsMap = {
        ETH: {
            uPerCont: 10,
            precision: [2, 0],
        },
        SOL: {
            uPerCont: 10,
            precision: [3, 0],
        },
        LINK: {
            uPerCont: 10,
            precision: [3, 0],
        },
        DOGE: {
            uPerCont: 10,
            precision: [5, 0],
        },
        AAVE: {
            uPerCont: 10,
            precision: [2, 0],
        },
        ATOM: {
            uPerCont: 10,
            precision: [3, 0],
        },
        AVAX: {
            uPerCont: 10,
            precision: [2, 0],
        },
        FTM: {
            uPerCont: 10,
            precision: [4, 0],
        },
        OP: {
            uPerCont: 10,
            precision: [4, 0],
        },
        LTC: {
            uPerCont: 10,
            precision: [2, 0],
        },
    };

    let instIDs = [];
    let instIDConfigs = {};
    for (let asset of assets) {
        const symbol = `${asset}USD_PERP`;
        instIDs.push(symbol);
        instIDConfigs[symbol] = {
            ContractNum: 1,
            VolPerCont: 1,
            UPerCont: assetsMap[asset]["uPerCont"],
            BaseAsset: asset,
            Leverage: 5,
            MaxContractNum: 100,
            EffectiveNum: 1,
            Precision: assetsMap[asset]["precision"],
            FirstOrderMargin: 0.0005,
            FirstOrderRangePercent: 0.0005,
            GapSizePercent: 0.00025,
            ForgivePercent: 1.00008,
            TickerShift: Number((0.000000125).toPrecision(9)),
            MaxOrderNum: 3,
            FarOrderNum: 5,
            VolatilityE: 0.75,
            VolatilityD: 5,
            VolatilityG: 120,
            MinimumTickerShift: 45,
            MaximumTickerShift: 75,
            BreakEvenX: 0.003,
            PositionReduceFactor: 5,
            PositionOffsetU: 200,
        };
    }
    console.log(JSON.stringify(instIDs));
    console.log(JSON.stringify(instIDConfigs));
};

main();
