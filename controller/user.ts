import { Router, Request, Response } from "express";
import { RowDataPacket } from 'mysql2';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/dbconn";
import express from "express";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";

export const router = express.Router();

// Upload config
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname)),
});

const upload = multer({ storage, limits: { fileSize: 64 * 1024 * 1024 } });

// 🔹 REGISTER – สมัครสมาชิกพร้อมรูปภาพ
router.post("/SignUp", upload.single("profile_image"), async (req: Request, res: Response) => {
    const { username, email, password, role } = req.body;
    const file = req.file;

    if (!username || !email || !password) return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });

    try {
        const [exists] = await db.query("SELECT * FROM user_account WHERE username = ? OR email = ?", [username, email]);
        if ((exists as any[]).length > 0) return res.status(400).json({ error: "username หรือ email ถูกใช้แล้ว" });

        const hash = await bcrypt.hash(password, 10);
        const imageUrl = file ? `/uploads/${file.filename}` : null;

        const [result] = await db.query(
            "INSERT INTO user_account (username, email, password_hash, role, profile_image_url, wallet_balance) VALUES (?, ?, ?, ?, ?, ?)",
            [username, email, hash, role || "user", imageUrl, 0]
        );

        res.json({
            message: "สมัครสมาชิกสำเร็จ",
            user: {
                id: (result as any).insertId,
                username,
                email,
                role: role || "user",
                wallet_balance: 0,
                profile_image_url: imageUrl
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});

// 🔹 LOGIN – เข้าสู่ระบบ
router.post("/Login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });

    try {
        const [rows] = await db.query("SELECT * FROM user_account WHERE email = ?", [email]);
        const user = (rows as any[])[0];
        if (!user) return res.status(401).json({ error: "ไม่พบผู้ใช้งานนี้" });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, "SECRET_KEY", { expiresIn: "2h" });

        res.json({
            message: "เข้าสู่ระบบสำเร็จ",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                wallet_balance: user.wallet_balance,
                profile_image_url: user.profile_image_url
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
// 🔹 GET USERS - ดึงข้อมูลผู้ใช้ทั้งหมด
router.get("/users", async (_req, res) => {
    try {
        const [rows] = await db.query("SELECT id, username, email, role, wallet_balance, created_at FROM user_account");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }
});


router.post('/update-profile', upload.single('profileImg'), async (req: Request, res: Response) => {
    try {
        const { userId, name } = req.body;
        let profile_image_url = '';

        if (req.file) {
            profile_image_url = `/uploads/${req.file.filename}`;
        }

        // อัปเดตฐานข้อมูล
        let query = '';
        const params: any[] = [];
        if (profile_image_url) {
            query = 'UPDATE user_account SET username = ?, profile_image_url = ? WHERE id = ?';
            params.push(name, profile_image_url, userId);
        } else {
            query = 'UPDATE user_account SET username = ? WHERE id = ?';
            params.push(name, userId);
        }

        await db.query(query, params);

        // ดึงข้อมูล user ใหม่
        const [rows] = await db.query<RowDataPacket[]>('SELECT id, username, profile_image_url, wallet_balance FROM user_account WHERE id = ?', [userId]);
        const user = rows[0];

        res.json({ success: true, user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

