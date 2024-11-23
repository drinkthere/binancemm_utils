const WebSocket = require("ws");
const https = require("https");
const dns = require("dns");
async function lookupDomain() {
    try {
        dns.resolve("fstream-mm.binance.com", "A", function (e, r) {
            if (e) console.log(e);
            else console.log(r);
        });
    } catch (err) {
        console.log(err);
    }
}
const main = async () => {
    await lookupDomain();

    const agent = new https.Agent({
        rejectUnauthorized: false,
        localAddress: "172.31.16.161",
        //localAddress: '172.31.27.218',
    });
    // 创建 WebSocket 客户端
    const ws = new WebSocket("wss://fstream-mm.binance.com/ws", { agent });

    ws.on("open", () => {
        // 订阅期货市场的 bookTicker 数据
        const subscriptionMessage = {
            method: "SUBSCRIBE",
            params: [
                "btcusdt@bookTicker", // 订阅 BTC/USDT 的 bookTicker 数据
            ],
            id: 1,
        };

        ws.send(JSON.stringify(subscriptionMessage));
        console.log(
            "Subscribed to futures bookTicker for BTC/USDT and ETH/USDT"
        );
    });

    ws.on("message", (data) => {
        // 接收到消息后打印
        const message = JSON.parse(data);
        console.log("Received message:", message);
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed");
    });

    // 处理程序退出时的清理工作
    process.on("SIGINT", () => {
        ws.close();
        console.log("Closed WebSocket connection");
        process.exit();
    });
};
main();
