const mysql = require("mysql2/promise");


const db = mysql.createPool({
    host: "sql12.freesqldatabase.com",
    user: "sql12820182",
    password: "RvgtKUreEp",
    database: "sql12820182",
    waitForConnections: true,
    connectionLimit: 10
});

// test connection
(async () => {
    try {
        const conn = await db.getConnection();
        console.log(" MySQL Connected");
        conn.release();
    } catch (err) {
        console.log(" DB Error:", err);
    }
})();

module.exports = db;
