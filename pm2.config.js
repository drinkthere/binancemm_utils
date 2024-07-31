module.exports = {
    apps: [
        {
            name: "stat_dtech001",
            script: "stat.js",
            args: "--account dtech001",
            out_file: "logs/stat-dtech001-out.log",
            error_file: "logs/stat-dtech001-out.log",
        },
    ],
};
