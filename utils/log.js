const log = (...msgs) => {
    const currentTime = new Date();
    const formattedTime = currentTime.toISOString();
    const logMessage = [
        formattedTime,
        ...msgs.map((msg) => JSON.stringify(msg)),
    ].join(" ");

    console.log(logMessage);
};
module.exports = { log };
