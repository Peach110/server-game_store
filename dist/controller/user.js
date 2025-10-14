"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.router = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const express_2 = __importDefault(require("express"));
const dbconn_1 = require("../db/dbconn"); // ✅ ปรับ path ตามโปรเจกต์คุณ
exports.router = (0, express_1.Router)();
// ✅ เปิด CORS และ Middleware พื้นฐาน
exports.router.use(express_2.default.json());
exports.router.use(express_2.default.urlencoded({ extended: true }));
// ===================== STATIC FILE SERVING FIX =====================
// FIX: ใช้ path.resolve('uploads') เพื่อให้ Express ชี้ไปที่โฟลเดอร์ uploads ที่ถูกสร้าง 
// โดย Multer อย่างถูกต้อง ไม่ว่าจะรันเซิร์ฟเวอร์จากที่ใด
exports.router.use('/uploads', express_2.default.static(path_1.default.resolve('uploads')));
// ===================================================================
// ตั้ง folder เก็บไฟล์ (Multer configuration)
const storage = multer_1.default.diskStorage({
    destination: function (_req, _file, cb) {
        // Multer บันทึกไฟล์ในโฟลเดอร์ 'uploads/' ซึ่งสัมพันธ์กับ CWD (Current Working Directory)
        cb(null, 'uploads/');
    },
    filename: function (_req, file, cb) {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});
exports.upload = (0, multer_1.default)({ storage });
// ================= SIGNUP =================
exports.router.post("/SignUp", exports.upload.single("profile_image"), async (req, res) => {
    const { username, email, password, role } = req.body;
    const file = req.file;
    if (!username || !email || !password) {
        return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    }
    try {
        // ✅ เชื่อมฐานข้อมูลจริง (ใช้ pool หรือ db ที่คุณ import มา)
        const [existing] = await dbconn_1.db.query("SELECT id FROM user_account WHERE email = ? OR username = ?", [email, username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: "อีเมลหรือชื่อผู้ใช้ถูกใช้แล้ว" });
        }
        // ✅ เข้ารหัสรหัสผ่าน
        const hash = await bcrypt_1.default.hash(password, 10);
        const imageUrl = file ? `/uploads/${file.filename}` : null;
        // ✅ บันทึกลง DB
        const [result] = await dbconn_1.db.query(`INSERT INTO user_account (username, email, password_hash, profile_image_url, role, wallet_balance)
       VALUES (?, ?, ?, ?, ?, 0.00)`, [username, email, hash, imageUrl, role || "user"]);
        // ✅ ตอบกลับ frontend
        res.json({
            message: "สมัครสมาชิกสำเร็จ",
            user: {
                id: result.insertId,
                username,
                email,
                role: role || "user",
                wallet_balance: 0,
                profile_image_url: imageUrl,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
exports.router.post("/Login", async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({ error: "กรุณากรอกอีเมล รหัสผ่าน และ role" });
    }
    try {
        // ดึง user จริงจาก DB
        const [rows] = await dbconn_1.db.query("SELECT * FROM user_account WHERE email = ?", [email]);
        if (!rows.length) {
            return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
        }
        const user = rows[0];
        // เช็กรหัสผ่าน
        const match = await bcrypt_1.default.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
        }
        // เช็ค role ว่าตรงกับที่ user เลือกหรือไม่
        if (user.role !== role) {
            return res.status(403).json({ error: "คุณไม่มีสิทธิ์เข้าใช้งานในส่วนนี้" });
        }
        // สร้าง JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, process.env.SECRET_KEY || "SECRET_KEY", { expiresIn: "2h" });
        res.json({
            message: "เข้าสู่ระบบสำเร็จ",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                wallet_balance: user.wallet_balance,
                profile_image_url: user.profile_image_url,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
// 🔹 GET USERS - ดึงข้อมูลผู้ใช้ทั้งหมด
exports.router.get("/users", async (_req, res) => {
    try {
        const [rows] = await dbconn_1.db.query("SELECT id, username, email, role, wallet_balance, created_at FROM user_account");
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }
});
exports.router.post("/update-profile", exports.upload.single("profileImg"), async (req, res) => {
    try {
        const { userId, name } = req.body;
        // 🔸 Validation เบื้องต้น
        if (!userId)
            return res.status(400).json({ success: false, error: "Missing userId" });
        let profile_image_url = null;
        // 🔸 ถ้ามีการอัปโหลดไฟล์ใหม่
        if (req.file) {
            profile_image_url = `/uploads/${req.file.filename}`;
        }
        // 🔸 อัปเดตข้อมูล
        const updateQuery = profile_image_url
            ? "UPDATE user_account SET username=?, profile_image_url=? WHERE id=?"
            : "UPDATE user_account SET username=? WHERE id=?";
        const params = profile_image_url ? [name, profile_image_url, userId] : [name, userId];
        await dbconn_1.db.query(updateQuery, params);
        // 🔸 ดึงข้อมูลผู้ใช้ที่อัปเดตแล้ว
        const [rows] = await dbconn_1.db.query("SELECT * FROM user_account WHERE id=?", [userId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, error: "ไม่พบผู้ใช้" });
        }
        const user = rows[0];
        // 🔸 ส่งกลับข้อมูลผู้ใช้ล่าสุด
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                wallet_balance: user.wallet_balance,
                profile_image_url: user.profile_image_url,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
//# sourceMappingURL=user.js.map