"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const dbconn_1 = require("../db/dbconn");
const express_2 = __importDefault(require("express"));
exports.router = (0, express_1.Router)();
// Middleware
exports.router.use(express_2.default.json());
exports.router.use(express_2.default.urlencoded({ extended: true }));
exports.router.get("/wallet", (req, res) => {
    res.send("hello wallet");
});
/** ✅ เติมเงิน */
exports.router.post("/wallet/topup", async (req, res) => {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0)
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ถูกต้อง" });
    try {
        // 🔹 อัปเดตยอดเงินใน user_account
        await dbconn_1.db.query("UPDATE user_account SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, userId]);
        // 🔹 เพิ่มประวัติธุรกรรม
        await dbconn_1.db.query("INSERT INTO wallet_transactions (user_id, type, amount) VALUES (?, 'เติมเงิน', ?)", [userId, amount]);
        // 🔹 ดึงข้อมูลผู้ใช้ล่าสุด
        const [rows] = await dbconn_1.db
            .query("SELECT id, username, wallet_balance, profile_image_url FROM user_account WHERE id = ?", [userId]);
        res.json({
            success: true,
            message: "เติมเงินสำเร็จ",
            user: rows[0],
        });
    }
    catch (err) {
        console.error("❌ เติมเงินล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});
/** ✅ ดึงประวัติการทำธุรกรรม */
exports.router.get("/wallet/history/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await dbconn_1.db
            .query("SELECT type, amount, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC", [userId]);
        res.json({ success: true, transactions: rows });
    }
    catch (err) {
        console.error("❌ ดึงประวัติธุรกรรมล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});
exports.router.post("/wallet/buy-game", async (req, res) => {
    const { userId, gameId } = req.body;
    try {
        // ดึงข้อมูลเกมและผู้ใช้
        const [userRows] = await dbconn_1.db.query("SELECT wallet_balance FROM user_account WHERE id = ?", [userId]);
        if (!userRows.length)
            return res.json({ success: false, message: "ไม่พบผู้ใช้" });
        const [gameRows] = await dbconn_1.db.query("SELECT price FROM game WHERE id = ?", [gameId]);
        if (!gameRows.length)
            return res.json({ success: false, message: "ไม่พบเกม" });
        const price = parseFloat(gameRows[0].price);
        const balance = parseFloat(userRows[0].wallet_balance);
        if (balance < price)
            return res.json({ success: false, message: "ยอดเงินไม่พอ" });
        // ✅ ลดเงินใน user_account
        await dbconn_1.db.query("UPDATE user_account SET wallet_balance = wallet_balance - ? WHERE id = ?", [price, userId]);
        // ✅ บันทึกธุรกรรม
        await dbconn_1.db.query("INSERT INTO wallet_transactions (user_id, type, amount) VALUES (?, 'ซื้อเกม', ?)", [userId, price]);
        // ✅ บันทึกคำสั่งซื้อ
        await dbconn_1.db.query("INSERT INTO purchase (user_id, total_amount, final_amount) VALUES (?, ?, ?)", [userId, price, price]);
        // ส่งข้อมูล user กลับ
        const [updatedUserRows] = await dbconn_1.db.query("SELECT * FROM user_account WHERE id = ?", [userId]);
        res.json({ success: true, user: updatedUserRows[0] });
    }
    catch (err) {
        console.error("❌ ซื้อเกมล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});
//# sourceMappingURL=wallet.js.map