"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.router = void 0;
const express_1 = require("express");
const dbconn_1 = require("../db/dbconn");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_2 = __importDefault(require("express"));
exports.router = (0, express_1.Router)();
// Middleware
exports.router.use(express_2.default.json());
exports.router.use(express_2.default.urlencoded({ extended: true }));
// ===================== Multer Setup =====================
const uploadsPath = path_1.default.resolve(__dirname, "../uploads");
if (!fs_1.default.existsSync(uploadsPath))
    fs_1.default.mkdirSync(uploadsPath, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsPath),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    },
});
exports.upload = (0, multer_1.default)({ storage });
// ===================== GET /games =====================
exports.router.get("/games", async (req, res) => {
    try {
        const [allGames] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, c.name as category
      FROM game g
      JOIN category c ON g.category_id = c.id
      ORDER BY g.title ASC
    `);
        const [newGames] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, c.name as category
      FROM game g
      JOIN category c ON g.category_id = c.id
      ORDER BY g.release_date DESC
      LIMIT 6
    `);
        const [hotGames] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, c.name as category, 
             SUM(p.quantity) as sold_count
      FROM game g
      JOIN category c ON g.category_id = c.id
      JOIN purchase_detail p ON g.id = p.game_id
      GROUP BY g.id
      ORDER BY sold_count DESC
      LIMIT 6
    `);
        // ดึงรูปทั้งหมดของเกม
        const gameIds = Array.from(new Set([...allGames.map(g => g.id), ...newGames.map(g => g.id), ...hotGames.map(g => g.id)]));
        let images = [];
        if (gameIds.length > 0) {
            const [rows] = await dbconn_1.db.query(`SELECT * FROM game_image WHERE game_id IN (?)`, [gameIds]);
            images = rows;
        }
        // map รูปเข้ากับเกม
        const addImages = (games) => games.map(g => {
            const imgs = images
                .filter(i => i.game_id === g.id)
                .map(i => `/uploads/${i.image_url}`);
            return {
                ...g,
                images: imgs,
                cover_image_url: imgs[0] || null,
            };
        });
        res.json({
            allGames: addImages(allGames),
            newGames: addImages(newGames),
            hotGames: addImages(hotGames),
        });
    }
    catch (err) {
        console.error("❌ Error fetching games:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเกม" });
    }
});
// ===================== GET /games/search-by-title =====================
exports.router.get("/games/search-by-title", async (req, res) => {
    try {
        const title = (req.query.title || "").trim();
        if (!title) {
            return res.status(400).json({ error: "กรุณาระบุชื่อเกมที่ต้องการค้นหา" });
        }
        const [games] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date,
             c.name AS category, g.cover_image_url
      FROM game g
      JOIN category c ON g.category_id = c.id
      WHERE g.title LIKE ?
      ORDER BY g.title ASC
    `, [`%${title}%`]);
        const gameIds = games.map(g => g.id);
        let images = [];
        if (gameIds.length > 0) {
            const [rows] = await dbconn_1.db.query(`
        SELECT * FROM game_image WHERE game_id IN (?)
      `, [gameIds]);
            images = rows;
        }
        const addImages = (games) => games.map(g => {
            const imgs = images
                .filter(i => i.game_id === g.id)
                .map(i => i.image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${i.image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${i.image_url.replace(/^\/+/, "")}`);
            const cover = g.cover_image_url
                ? (g.cover_image_url.includes("uploads/")
                    ? `${req.protocol}://${req.get("host")}/${g.cover_image_url.replace(/^\/+/, "")}`
                    : `${req.protocol}://${req.get("host")}/uploads/${g.cover_image_url.replace(/^\/+/, "")}`)
                : imgs[0] || null;
            return { ...g, images: imgs, cover_image_url: cover };
        });
        res.json(addImages(games));
    }
    catch (err) {
        console.error("❌ Error searching games by title:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาชื่อเกม" });
    }
});
// ===================== GET /games/search-by-category =====================
exports.router.get("/games/search-by-category", async (req, res) => {
    try {
        const category = (req.query.category || "").trim();
        if (!category || category === "All") {
            return res.status(400).json({ error: "กรุณาระบุประเภทเกมที่ต้องการค้นหา" });
        }
        const [games] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date,
             c.name AS category, g.cover_image_url
      FROM game g
      JOIN category c ON g.category_id = c.id
      WHERE c.name = ?
      ORDER BY g.title ASC
    `, [category]);
        const gameIds = games.map(g => g.id);
        let images = [];
        if (gameIds.length > 0) {
            const [rows] = await dbconn_1.db.query(`
        SELECT * FROM game_image WHERE game_id IN (?)
      `, [gameIds]);
            images = rows;
        }
        const addImages = (games) => games.map(g => {
            const imgs = images
                .filter(i => i.game_id === g.id)
                .map(i => i.image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${i.image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${i.image_url.replace(/^\/+/, "")}`);
            const cover = g.cover_image_url
                ? (g.cover_image_url.includes("uploads/")
                    ? `${req.protocol}://${req.get("host")}/${g.cover_image_url.replace(/^\/+/, "")}`
                    : `${req.protocol}://${req.get("host")}/uploads/${g.cover_image_url.replace(/^\/+/, "")}`)
                : imgs[0] || null;
            return { ...g, images: imgs, cover_image_url: cover };
        });
        res.json(addImages(games));
    }
    catch (err) {
        console.error("❌ Error searching games by category:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาตามประเภทเกม" });
    }
});
// ===================== GET /games/:id =====================
exports.router.get("/games/:id", async (req, res) => {
    try {
        const gameId = parseInt(req.params.id, 10);
        if (isNaN(gameId)) {
            return res.status(400).json({ error: "ID เกมไม่ถูกต้อง" });
        }
        // ✅ ดึงข้อมูลเกมหลัก
        const [rows] = await dbconn_1.db.query(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, 
             c.name AS category, g.cover_image_url
      FROM game g
      JOIN category c ON g.category_id = c.id
      WHERE g.id = ?
    `, [gameId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "ไม่พบเกมนี้" });
        }
        const game = rows[0];
        // ✅ ดึงภาพทั้งหมดของเกม
        const [images] = await dbconn_1.db.query(`
      SELECT image_url FROM game_image WHERE game_id = ?
    `, [gameId]);
        const imageList = images.map(img => {
            const path = img.image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${img.image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${img.image_url.replace(/^\/+/, "")}`;
            return path;
        });
        // ✅ ปรับ cover image
        const cover = game.cover_image_url
            ? (game.cover_image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${game.cover_image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${game.cover_image_url.replace(/^\/+/, "")}`)
            : imageList[0] || null;
        res.json({
            id: game.id,
            title: game.title,
            description: game.description,
            category: game.category,
            release_date: game.release_date,
            price: game.price,
            cover_image_url: cover,
            images: imageList
        });
    }
    catch (err) {
        console.error("❌ Error getting game detail:", err);
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงรายละเอียดเกม" });
    }
});
exports.router.get("/games/hot", async (req, res) => {
    try {
        const [rows] = await dbconn_1.db.query(`
      SELECT g.*, COUNT(pd.game_id) AS total_purchased
      FROM game g
      JOIN purchase_detail pd ON g.id = pd.game_id
      GROUP BY g.id
      ORDER BY total_purchased DESC
      LIMIT 10
    `);
        res.json({ success: true, hotGames: rows });
    }
    catch (err) {
        console.error("🔥 Error loading hot games:", err);
        res.status(500).json({ success: false, message: "โหลดเกมยอดฮิตล้มเหลว" });
    }
});
//# sourceMappingURL=games.js.map