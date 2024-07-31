const mysql = require("mysql");
const { log } = require("./log");
class MySQLConnector {
    constructor(config) {
        this.pool = mysql.createPool(config);
    }

    async query(sql, values) {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((err, connection) => {
                if (err) {
                    reject(err);
                    return;
                }

                connection.query(sql, values, (queryErr, results) => {
                    connection.release(); // 释放连接回连接池
                    if (queryErr) {
                        reject(queryErr);
                        return;
                    }
                    resolve(results);
                });
            });
        });
    }

    async getData(
        tableName,
        columns = "*",
        conditions = "",
        orderby = "",
        limit = ""
    ) {
        let sql = `SELECT ${columns} FROM ${tableName}`;
        if (conditions) {
            sql += ` WHERE ${conditions}`;
        }

        if (orderby) {
            sql += ` ORDER BY ${orderby}`;
        }

        if (limit) {
            sql += ` LIMIT ${limit}`;
        }

        return this.query(sql);
    }

    async insertData(tableName, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = Array(keys.length).fill("?").join(",");

        const sql = `INSERT INTO ${tableName} (${keys.join(
            ","
        )}) VALUES (${placeholders})`;
        return this.query(sql, values);
    }

    async updateData(tableName, update, conditions) {
        let sql = `UPDATE ${tableName} SET ${update}`;
        if (conditions) {
            sql += ` WHERE ${conditions}`;
        }
        return this.query(sql);
    }

    async deleteData(tableName, conditions) {
        let sql = `DELETE FROM ${tableName} `;
        if (conditions) {
            sql += ` WHERE ${conditions}`;
        }
        log(sql);
        return this.query(sql);
    }

    async close() {
        this.pool.end();
    }
}
module.exports = MySQLConnector;
