const WebSocket = require("ws");

const sourceIp = "172.31.16.149";
const ws = new WebSocket("ws://8.218.155.239:55551", {
    localAddress: sourceIp,
});

ws.on("open", () => {
    console.log("WebSocket connection opened");
    ws.send("Hello Server!"); // 发送消息到服务器
});

ws.on("message", (data) => {
    console.log("Received message:", data); // 打印服务器发送的消息
});

ws.on("error", (error) => {
    console.error("WebSocket error:", error);
});

ws.on("close", () => {
    console.log("WebSocket connection closed");
});
