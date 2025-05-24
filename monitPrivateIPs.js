const BinanceClient = require("./clients/binance");
const { sleep, fileExists, scheduleLoopTask } = require("./utils/run");
const { log } = require("./utils/log");
const cfgFile = `./configs/config.json`;
if (!fileExists(cfgFile)) {
    log(`config file ${cfgFile} does not exits`);
    process.exit();
}
const configs = require(cfgFile);
const main = async () => {
    try {
        const ips = [
            "172.31.16.148",
            // "172.31.16.149", 已经没有绑定在这台服务器了
            "172.31.16.150",
            "172.31.16.151",
            "172.31.16.152",
            "172.31.16.153",
            "172.31.16.154",
            "172.31.16.155",
            "172.31.16.156",
            "172.31.16.157",
            "172.31.16.158",
            "172.31.16.159",
            "172.31.16.160",
        ];

        scheduleLoopTask(async () => {
            let invalidIps = [];
            for (let ip of ips) {
                let options = {
                    localAddress: ip,
                    intranet: true,
                };
                const exchangeClient = new BinanceClient(options);
                let pingResult = false;
                for (let i = 0; i < 3; i++) {
                    const result = await exchangeClient.ping();
                    if (JSON.stringify(result) == "{}") {
                        pingResult = true;
                        break;
                    }
                    await sleep(1000);
                }
                if (!pingResult) {
                    invalidIps.push(ip);
                }
                await sleep(1000);
            }

            if (invalidIps.length > 0) {
                const msg = `${invalidIps.join(
                    "|"
                )} ping fapi-mm failed 3 times`;
                log(msg);
                tgService.sendMsg(msg);
            } else {
                log("all ips work well.");
            }
            await sleep(60 * 1000);
        });
    } catch (e) {
        console.error(e);
    }
};
main();
