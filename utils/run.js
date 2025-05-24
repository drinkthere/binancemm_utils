const fs = require("fs");
const path = require("path");
const newInterval = (func, millisecond) => {
    const inside = async () => {
        await func();
        setTimeout(inside, millisecond);
    };
    setTimeout(inside, millisecond);
};

function sleep(ms = 0, cb) {
    if (cb) {
        return new Promise(() => {
            setTimeout(cb, ms);
        });
    } else {
        return new Promise((r) => setTimeout(r, ms));
    }
}

async function scheduleLoopTask(task, stopFunc) {
    const _loop = async () => {
        await task();
        if (stopFunc && stopFunc()) {
            return;
        }
        return _loop();
    };
    return _loop();
}

async function scheduleLoopTaskWithArgs(task, taskArgs, stopFunc) {
    const _loop = async (args) => {
        await task(...args); // 在这里调用task函数并传递参数
        if (stopFunc && stopFunc()) {
            return;
        }
        _loop(args);
    };
    _loop(taskArgs); // 调用闭包并传递taskArgs
}

function getDecimals(numString) {
    numString = numString.replace(/\.?0+$/, "");
    if (numString.includes(".")) {
        let decimalIndex = numString.indexOf(".");
        let decimals = numString.length - decimalIndex - 1;
        return decimals;
    } else {
        return 0;
    }
}

function formatQty(quantity, precision) {
    const decimals = getDecimals(precision);
    if (quantity > 0) {
        // For positive numbers, round down the last digit
        const factor = Math.pow(10, decimals);
        return Math.floor(quantity * factor) / factor;
    } else if (quantity < 0) {
        // For negative numbers, round up the last digit
        const factor = Math.pow(10, decimals);
        return -Math.ceil(-quantity * factor) / factor;
    }
    return 0;
}

function formatQtyCeil(quantity, precision) {
    const decimals = getDecimals(precision);
    if (quantity > 0) {
        // For positive numbers, round down the last digit
        const factor = Math.pow(10, decimals);
        return Math.ceil(quantity * factor) / factor;
    } else if (quantity < 0) {
        // For negative numbers, round up the last digit
        const factor = Math.pow(10, decimals);
        return -Math.ceil(-quantity * factor) / factor;
    }
    return 0;
}

function convertScientificToString(scientificNumber) {
    const floatValue = parseFloat(scientificNumber);
    let stringValue = String(floatValue);
    if (stringValue.indexOf("-") >= 0) {
        stringValue = "0" + String(Number(stringValue) + 1).slice(1);
    }
    return stringValue;
}

function fileExists(filePath) {
    try {
        // 使用 fs.accessSync() 方法来检查文件是否存在
        fs.accessSync(filePath, fs.constants.F_OK);
        return true; // 文件存在
    } catch (error) {
        return false; // 文件不存在或无法访问
    }
}

function deleteFilesInDirectory(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error("Error reading directory:", err);
            return;
        }

        // 遍历目录中的所有文件
        files.forEach((file) => {
            const filePath = path.join(directory, file);

            // 删除文件
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error("Error deleting file:", err);
                    return;
                }
                console.log("Deleted file:", filePath);
            });
        });
    });
}

// 将字符串写入文件
function writeStringToFile(filePath, content) {
    fs.writeFileSync(filePath, content, (err) => {
        if (err) {
            console.error("Error writing to file:", err);
            return;
        }
        console.log("Content has been written to", filePath);
    });
}

function convertToTimestamp(dateTimeStr) {
    // 检查输入参数
    if (!dateTimeStr || typeof dateTimeStr !== "string") {
        throw new Error("输入必须是一个有效的日期时间字符串");
    }

    // 确保格式正确
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateTimeStr)) {
        throw new Error("日期时间格式应为: YYYY-MM-DD HH:MM:SS");
    }

    // 创建日期对象并获取时间戳
    const timestamp = new Date(dateTimeStr.replace(" ", "T")).getTime();

    // 验证结果是否为有效数字
    if (isNaN(timestamp)) {
        throw new Error("无法将输入转换为有效的时间戳");
    }

    return timestamp;
}

module.exports = {
    sleep,
    scheduleLoopTask,
    scheduleLoopTaskWithArgs,
    getDecimals,
    formatQty,
    formatQtyCeil,
    convertScientificToString,
    fileExists,
    deleteFilesInDirectory,
    writeStringToFile,
    convertToTimestamp,
};
