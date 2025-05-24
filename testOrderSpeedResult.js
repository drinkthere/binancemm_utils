const fs = require("fs");
const logFile = "ioc_filled.log";
const title = "IOC Spot Filled Order ZoneA";
{
    // 读取public.log文件内容
    const data = fs.readFileSync(logFile, "utf-8").trim().split("\n");

    // 将文件内容解析为行数据
    const lines = data.map((line) => line.split(" "));

    // 创建一个对象用于存储结果
    const result = {};

    // 遍历每一行
    for (const line of lines) {
        const id = line[0];
        const type = line[1];
        const time = parseInt(line[2]);

        if (!result[id]) {
            // 如果当前id在结果对象中不存在，则创建一个新的条目
            result[id] = {
                id: id,
                newTimeDiff: 0,
                submittedTimeDiff: 0,
            };
        }

        // if (type === "EXPIRED") {
        // if (type === "NEW") {
        if (type === "FILLED") {
            if (result[id] && result[id].submitTime) {
                // 计算NEW的时间差
                result[id].newTimeDiff = time - result[id].submitTime;
            }
        } else if (type === "NEWSUBMIT") {
            // 记录NEWSUBMIT的时间
            result[id].submitTime = time;
        } else if (type === "NEWSUBMITTED") {
            if (result[id] && result[id].submitTime) {
                // 计算NEWSUBMITTED的时间差
                result[id].submittedTimeDiff = time - result[id].submitTime;
            }
        }
    }

    // 打印结果
    let i = 0;
    let sumNew = 0;
    let sumSubmitted = 0;
    for (const id in result) {
        const entry = result[id];
        if (entry.newTimeDiff) {
            sumNew += entry.newTimeDiff;
            sumSubmitted += entry.submittedTimeDiff;
            i++;
        }

        //   console.log(`ID: ${entry.id}`);
        //   console.log(`NEW时间差: ${entry.newTimeDiff}`);
        //   console.log(`NEWSUBMITTED时间差: ${entry.submittedTimeDiff}`);
        //   console.log('---------------------');
    }
    // console.log(`${title} avgNew=${sumNew / i} avgSubmitted=${sumSubmitted / i}`);
    console.log(`${title} avgNew=${sumNew / i} ms`);
}
{
    // 读取public.log文件内容
    const data = fs.readFileSync(logFile, "utf-8").trim().split("\n");

    // 将文件内容解析为行数据
    const lines = data.map((line) => line.split(" "));

    // 创建一个对象用于存储结果
    const result = {};

    // 遍历每一行
    for (const line of lines) {
        const id = line[0];
        const type = line[1];
        const time = parseInt(line[2]);

        if (!result[id]) {
            // 如果当前id在结果对象中不存在，则创建一个新的条目
            result[id] = {
                id: id,
                cancelSubmitTimeDiff: 0,
                canceledTimeDiff: 0,
            };
        }

        if (type === "CANCELSUBMIT") {
            // 记录CANCELSUBMIT的时间
            result[id].cancelSubmitTime = time;
        } else if (type === "CANCELSUBMITTED") {
            // 计算CANCELSUBMITTED的时间差
            result[id].cancelSubmitTimeDiff =
                time - result[id].cancelSubmitTime;
        } else if (type === "CANCELED") {
            // 计算CANCELED的时间差
            result[id].canceledTimeDiff = time - result[id].cancelSubmitTime;
        }
    }

    // 打印结果
    let i = 0;
    let sumCanceled = 0;
    // for (const id in result) {
    //   const entry = result[id];
    //   console.log(`ID: ${entry.id}`);
    //   console.log(`CANCELSUBMITTED时间差: ${entry.cancelSubmitTimeDiff}`);
    //   console.log(`CANCELED时间差: ${entry.canceledTimeDiff}`);
    //   console.log('---------------------');
    // }

    for (const id in result) {
        const entry = result[id];
        if (entry.canceledTimeDiff) {
            sumCanceled += entry.canceledTimeDiff;

            i++;
        }
    }
    console.log(`${title}  avgCancel=${sumCanceled / i} ms`);
}
