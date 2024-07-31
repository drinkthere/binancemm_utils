const MySQLConnector = require("../utils/mysql");
// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();

class StatOrderService {
    constructor() {
        this.db = new MySQLConnector({
            connectionLimit: 2, // 连接池大小
            host: process.env.DB_HOST,
            port: 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
        });
    }

    // timeStr => 15 MINUTE
    async getTradingAmt(account, timeStr) {
        let totalAmount = 0;
        let btcFactor = 0.04;
        let ethFactor = 0.03;
        const results = await this.db.getData(
            `tb_order_${account}`,
            "symbol, notional",
            `order_type='OPEN' and create_time >= DATE_SUB(NOW(), INTERVAL ${timeStr})`
        );
        if (results == null || results.length == 0) {
            return totalAmount;
        }

        results.forEach((record) => {
            let tradingAmount = parseFloat(record.notional);
            if (["BTCUSDT", "BTC-USDT-SWAP"].includes(record.symbol)) {
                tradingAmount *= btcFactor;
            } else if (["ETHUSDT", "ETH-USDT-SWAP"].includes(record.symbol)) {
                tradingAmount *= ethFactor;
            }
            totalAmount += tradingAmount;
        });
        return totalAmount;
    }

    async saveOrder(table, order) {
        await this.db.insertData(table, order);
    }

    async saveBalance(balance) {
        await this.db.insertData("tb_balance", balance);
    }

    async end() {
        this.db.close();
    }
}
module.exports = StatOrderService;
