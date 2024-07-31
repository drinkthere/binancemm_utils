const { log } = require("../utils/log");
const TelegramBot = require("node-telegram-bot-api");

// 加载.env文件
const dotenv = require("dotenv");
dotenv.config();

class TgService {
    constructor() {
        // 初始化Binance client
        this.client = new TelegramBot(process.env.TG_TOKEN);
        this.channelId = process.env.TG_CHANNEL_ID;
    }

    async sendMsg(message) {
        try {
            this.client.sendMessage(this.channelId, message);
        } catch (e) {
            log(e.constructor.name, e.message);
        }
    }
}
module.exports = TgService;
