CREATE TABLE `tb_order_dcs005` (
  `id` int NOT NULL AUTO_INCREMENT,
  `symbol` varchar(20) NOT NULL DEFAULT '',
  `side` varchar(5) NOT NULL DEFAULT '',
  `quantity` int NOT NULL DEFAULT '0',
  `amount` float NOT NULL DEFAULT '0',
  `price` float NOT NULL DEFAULT '0',
  `notional` float NOT NULL DEFAULT '0',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE EVENT IF NOT EXISTS clear_orders_dcs005
ON SCHEDULE EVERY 1 DAY
STARTS (TIMESTAMP(CURRENT_DATE) + INTERVAL 1 DAY)
DO
  DELETE FROM tb_order_sma003 WHERE create_time < NOW() - INTERVAL 7 DAY;