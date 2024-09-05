module.exports = {
    apps: [
        {
            name: "monit_okx_ticker",
            script: "monitOkxTicker.js",
            args: "",
            out_file: "logs/monit-okx-ticker-out.log",
            error_file: "logs/monit-okx-ticker-out.log",
        },
        {
            name: "stat_btech001",
            script: "stat.js",
            args: "--account btech001",
            out_file: "logs/stat-btech001-out.log",
            error_file: "logs/stat-btech001-out.log",
        },
        {
            name: "stat_btech002",
            script: "stat.js",
            args: "--account btech002",
            out_file: "logs/stat-btech002-out.log",
            error_file: "logs/stat-btech002-out.log",
        },
        {
            name: "stat_btech003",
            script: "stat.js",
            args: "--account btech003",
            out_file: "logs/stat-btech003-out.log",
            error_file: "logs/stat-btech003-out.log",
        },
        {
            name: "stat_cmm_btech001",
            script: "deliverystat.js",
            args: "--account btech001",
            out_file: "logs/stat-cmm-btech001-out.log",
            error_file: "logs/stat-cmm-btech001-out.log",
        },
    ],
};
