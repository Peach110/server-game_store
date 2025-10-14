  import mysql from "mysql2/promise";
  import dotenv from "dotenv";

  dotenv.config();

  export const db = mysql.createPool({
    host: process.env.DB_HOST || "202.28.34.203",
    user: process.env.DB_USER || "mb68_66011212222",
    password: process.env.DB_PASS || "@Hq27hP@LnQo",
    database: process.env.DB_NAME || "mb68_66011212222",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000,
  });

  (async () => {
    try {
      const connection = await db.getConnection();
      console.log("✅ Connected to MySQL successfully!");
      connection.release();
    } catch (err) {
      console.error("❌ Database connection failed:", err);
    }
  })();
