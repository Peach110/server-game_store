"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.db = promise_1.default.createPool({
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
        const connection = await exports.db.getConnection();
        console.log("✅ Connected to MySQL successfully!");
        connection.release();
    }
    catch (err) {
        console.error("❌ Database connection failed:", err);
    }
})();
//# sourceMappingURL=dbconn.js.map