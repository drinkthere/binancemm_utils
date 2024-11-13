module.exports = {
    apps: [
        {
            name: "monit_okx_ticker",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node monitOkxTicker.js"',
            out_file: "logs/monit-okx-ticker-out.log",
            error_file: "logs/monit-okx-ticker-error.log",
        },
        {
            name: "monit_okx_zoneb_ticker",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node monitOkxZoneBTicker.js"',
            out_file: "logs/monit-okx-zoneb-ticker-out.log",
            error_file: "logs/monit-okx-zoneb-ticker-error.log",
        },
        {
            name: "stat_btech001",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node stat.js --account btech001"',
            out_file: "logs/stat-btech001-out.log",
            error_file: "logs/stat-btech001-error.log",
        },
        {
            name: "stat_btech002",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node stat.js --account btech002"',
            out_file: "logs/stat-btech002-out.log",
            error_file: "logs/stat-btech002-error.log",
        },
        {
            name: "stat_btech003",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node stat.js --account btech003"',
            out_file: "logs/stat-btech003-out.log",
            error_file: "logs/stat-btech003-error.log",
        },
        {
            name: "stat_fbg001",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node stat.js --account fbg001"',
            out_file: "logs/stat-fbg001-out.log",
            error_file: "logs/stat-fbg001-error.log",
        },
        {
            name: "stat_fbg002",
            script: "/usr/bin/bash",
            args: '-c "taskset -c 7 node stat.js --account fbg002"',
            out_file: "logs/stat-fbg002-out.log",
            error_file: "logs/stat-fbg002-error.log",
        },
    ],
};
