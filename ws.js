const WebSocket = require("ws");
const http = require("http");

// 创建一个 HTTP 服务器
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// 当有客户端连接时触发
wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress; // 获取请求的 IP 地址
    console.log(`Client connected from IP: ${ip}`);

    // 可以在这里处理消息
    ws.on("message", (message) => {
        console.log(`Received message: ${message}`);
    });

    // 向客户端发送消息
    ws.send("Welcome to the WebSocket server!");
});

// 启动服务器
const PORT = 55551;
server.listen(PORT, () => {
    console.log(`WebSocket server is listening on ws://127.0.0.1:${PORT}`);
});
