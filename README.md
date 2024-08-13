# 安装 nodejs 和 npm

```Shell
sudo apt-get install nodejs npm -y
```

# 安装 pm2

```Shell
sudo npm install -g pm2
```

# 安装 pm2-logrotate

```Shell
pm2 install pm2-logrotate
```

# 配置 logrotate

```Shell
pm2 set pm2-logrotate:max_size 100M  // 单个日志文件最大100M
pm2 set pm2-logrotate:retain 2 // 最多保留两个日志文件
```

# 执行脚本

启动对冲脚本

```Shell
pm2 start pm2.config.js --only=stat_btech001
```

其他文件都是直接用 node xxx.js 执行
