import { Router, Request, Response } from "express";
import { db } from "../db/dbconn";
import express from "express";
export const router = Router();

// Middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));


router.get("/wallet", (req, res) => {
    res.send("hello wallet");
});


/** ✅ เติมเงิน */
router.post("/wallet/topup", async (req: Request, res: Response) => {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0)
        return res.status(400).json({ success: false, message: "ข้อมูลไม่ถูกต้อง" });

    try {
        // 🔹 อัปเดตยอดเงินใน user_account
        await db.query(
            "UPDATE user_account SET wallet_balance = wallet_balance + ? WHERE id = ?",
            [amount, userId]
        );

        // 🔹 เพิ่มประวัติธุรกรรม
        await db.query(
            "INSERT INTO wallet_transactions (user_id, type, amount) VALUES (?, 'เติมเงิน', ?)",
            [userId, amount]
        );

        // 🔹 ดึงข้อมูลผู้ใช้ล่าสุด
        const [rows]: any = await db
            .query(
                "SELECT id, username, wallet_balance, profile_image_url FROM user_account WHERE id = ?",
                [userId]
            );

        res.json({
            success: true,
            message: "เติมเงินสำเร็จ",
            user: rows[0],
        });
    } catch (err) {
        console.error("❌ เติมเงินล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});

/** ✅ ดึงประวัติการทำธุรกรรม */
router.get("/wallet/history/:userId", async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
        const [rows]: any = await db
            .query(
                "SELECT type, amount, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
                [userId]
            );

        res.json({ success: true, transactions: rows });
    } catch (err) {
        console.error("❌ ดึงประวัติธุรกรรมล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});

router.post("/wallet/buy-game", async (req: Request, res: Response) => {
    const { userId, gameId } = req.body;

    try {
        // ดึงข้อมูลเกมและผู้ใช้
        const [userRows]: any = await db.query(
            "SELECT wallet_balance FROM user_account WHERE id = ?",
            [userId]
        );
        if (!userRows.length) return res.json({ success: false, message: "ไม่พบผู้ใช้" });

        const [gameRows]: any = await db.query(
            "SELECT price FROM game WHERE id = ?",
            [gameId]
        );
        if (!gameRows.length) return res.json({ success: false, message: "ไม่พบเกม" });

        const price = parseFloat(gameRows[0].price);
        const balance = parseFloat(userRows[0].wallet_balance);

        if (balance < price) return res.json({ success: false, message: "ยอดเงินไม่พอ" });

        // ✅ ลดเงินใน user_account
        await db.query("UPDATE user_account SET wallet_balance = wallet_balance - ? WHERE id = ?", [price, userId]);

        // ✅ บันทึกธุรกรรม
        await db.query(
            "INSERT INTO wallet_transactions (user_id, type, amount) VALUES (?, 'ซื้อเกม', ?)",
            [userId, price]
        );

        // ✅ บันทึกคำสั่งซื้อ
        await db.query(
            "INSERT INTO purchase (user_id, total_amount, final_amount) VALUES (?, ?, ?)",
            [userId, price, price]
        );

        // ส่งข้อมูล user กลับ
        const [updatedUserRows]: any = await db.query("SELECT * FROM user_account WHERE id = ?", [userId]);

        res.json({ success: true, user: updatedUserRows[0] });
    } catch (err) {
        console.error("❌ ซื้อเกมล้มเหลว:", err);
        res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
    }
});

