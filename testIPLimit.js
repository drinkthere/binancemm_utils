const https = require("https");

// 指定本地地址（如需要）
const localAddress = "172.31.16.154"; // 替换为您的本地地址

const maxRequests = 8000;
let requestCount = 0;

function sendRequest() {
    const options = {
        hostname: "fapi.binance.com",
        path: "/fapi/v1/ping",
        method: "GET",
        localAddress: localAddress, // 指定本地地址
    };

    const req = https.request(options, (res) => {
        requestCount++;
        console.log(
            `Request #${requestCount}: HTTP Status Code: ${res.statusCode}`
        );

        // 检查状态码
        if (res.statusCode === 429 || requestCount >= maxRequests) {
            console.log("Stopping requests...");
            req.end();
            return;
        }

        // 继续发送下一个请求
        sendRequest();
    });

    req.on("error", (e) => {
        console.error(`Problem with request: ${e.message}`);
        // 继续尝试发送下一个请求
        sendRequest();
    });

    req.end();
}
console.time();
// 开始发送请求
sendRequest();
console.timeEnd();
console.log(requestCount);
