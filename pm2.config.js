module.exports = {
    apps: [
        {
            name: "stat_dtech001",
            script: "stat.js",
            args: "--account dtech001",
            out_file: "logs/stat-dtech001-out.log",
            error_file: "logs/stat-dtech001-out.log",
        },
        {
            name: "stat_dtech002",
            script: "stat.js",
            args: "--account dtech002",
            out_file: "logs/stat-dtech002-out.log",
            error_file: "logs/stat-dtech002-out.log",
        },
        {
            name: "stat_dtech003",
            script: "stat.js",
            args: "--account dtech003",
            out_file: "logs/stat-dtech003-out.log",
            error_file: "logs/stat-dtech003-out.log",
        },
    ],
};
