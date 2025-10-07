"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dbconn_1 = require("../db/dbconn");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
exports.router = express_1.default.Router();
// Upload config
const uploadsDir = path_1.default.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir))
    fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => cb(null, (0, uuid_1.v4)() + path_1.default.extname(file.originalname)),
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 64 * 1024 * 1024 } });
// 🔹 REGISTER – สมัครสมาชิกพร้อมรูปภาพ
exports.router.post("/SignUp", upload.single("profile_image"), async (req, res) => {
    const { username, email, password, role } = req.body;
    const file = req.file;
    if (!username || !email || !password)
        return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    try {
        const [exists] = await dbconn_1.db.query("SELECT * FROM user_account WHERE username = ? OR email = ?", [username, email]);
        if (exists.length > 0)
            return res.status(400).json({ error: "username หรือ email ถูกใช้แล้ว" });
        const hash = await bcrypt_1.default.hash(password, 10);
        const imageUrl = file ? `/uploads/${file.filename}` : null;
        const [result] = await dbconn_1.db.query("INSERT INTO user_account (username, email, password_hash, role, profile_image_url, wallet_balance) VALUES (?, ?, ?, ?, ?, ?)", [username, email, hash, role || "user", imageUrl, 0]);
        res.json({
            message: "สมัครสมาชิกสำเร็จ",
            user: {
                id: result.insertId,
                username,
                email,
                role: role || "user",
                wallet_balance: 0,
                profile_image_url: imageUrl
            }
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ" });
    }
});
// 🔹 LOGIN – เข้าสู่ระบบ
exports.router.post("/Login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" });
    try {
        const [rows] = await dbconn_1.db.query("SELECT * FROM user_account WHERE email = ?", [email]);
        const user = rows[0];
        if (!user)
            return res.status(401).json({ error: "ไม่พบผู้ใช้งานนี้" });
        const match = await bcrypt_1.default.compare(password, user.password_hash);
        if (!match)
            return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.role }, "SECRET_KEY", { expiresIn: "2h" });
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
exports.router.post('/update-profile', upload.single('profileImg'), async (req, res) => {
    try {
        const { userId, name } = req.body;
        let profile_image_url = '';
        if (req.file) {
            profile_image_url = `/uploads/${req.file.filename}`;
        }
        // อัปเดตฐานข้อมูล
        let query = '';
        const params = [];
        if (profile_image_url) {
            query = 'UPDATE user_account SET username = ?, profile_image_url = ? WHERE id = ?';
            params.push(name, profile_image_url, userId);
        }
        else {
            query = 'UPDATE user_account SET username = ? WHERE id = ?';
            params.push(name, userId);
        }
        await dbconn_1.db.query(query, params);
        // ดึงข้อมูล user ใหม่
        const [rows] = await dbconn_1.db.query('SELECT id, username, profile_image_url, wallet_balance FROM user_account WHERE id = ?', [userId]);
        const user = rows[0];
        res.json({ success: true, user });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
//# sourceMappingURL=user.js.map