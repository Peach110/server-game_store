import { Router, Request, Response } from "express";
import { RowDataPacket } from "mysql2";
import { db } from "../db/dbconn";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

export const router = Router();

// Middleware
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// ===================== Multer Setup =====================
const uploadsPath = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsPath),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});
export const upload = multer({ storage });

// ===================== GET /games =====================
router.get("/games", async (req: Request, res: Response) => {
  try {
    const [allGames] = await db.query<RowDataPacket[]>(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, c.name as category
      FROM game g
      JOIN category c ON g.category_id = c.id
      ORDER BY g.title ASC
    `);

    const [newGames] = await db.query<RowDataPacket[]>(`
      SELECT g.id, g.title, g.price, g.description, g.release_date, c.name as category
      FROM game g
      JOIN category c ON g.category_id = c.id
      ORDER BY g.release_date DESC
      LIMIT 6
    `);

    const [hotGames] = await db.query<RowDataPacket[]>(`
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
    const gameIds = Array.from(
      new Set([...allGames.map(g => g.id), ...newGames.map(g => g.id), ...hotGames.map(g => g.id)])
    );

    let images: RowDataPacket[] = [];
    if (gameIds.length > 0) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT * FROM game_image WHERE game_id IN (?)`,
        [gameIds]
      );
      images = rows;
    }

    // map รูปเข้ากับเกม
    const addImages = (games: RowDataPacket[]) =>
      games.map(g => {
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
  } catch (err) {
    console.error("❌ Error fetching games:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลเกม" });
  }
});

// ===================== GET /games/search-by-title =====================
router.get("/games/search-by-title", async (req: Request, res: Response) => {
  try {
    const title = (req.query.title as string || "").trim();

    if (!title) {
      return res.status(400).json({ error: "กรุณาระบุชื่อเกมที่ต้องการค้นหา" });
    }

    const [games] = await db.query<RowDataPacket[]>(`
      SELECT g.id, g.title, g.price, g.description, g.release_date,
             c.name AS category, g.cover_image_url
      FROM game g
      JOIN category c ON g.category_id = c.id
      WHERE g.title LIKE ?
      ORDER BY g.title ASC
    `, [`%${title}%`]);

    const gameIds = games.map(g => g.id);
    let images: RowDataPacket[] = [];
    if (gameIds.length > 0) {
      const [rows] = await db.query<RowDataPacket[]>(`
        SELECT * FROM game_image WHERE game_id IN (?)
      `, [gameIds]);
      images = rows;
    }

    const addImages = (games: RowDataPacket[]) =>
      games.map(g => {
        const imgs = images
          .filter(i => i.game_id === g.id)
          .map(i =>
            i.image_url.includes("uploads/")
              ? `${req.protocol}://${req.get("host")}/${i.image_url.replace(/^\/+/, "")}`
              : `${req.protocol}://${req.get("host")}/uploads/${i.image_url.replace(/^\/+/, "")}`
          );

        const cover = g.cover_image_url
          ? (
              g.cover_image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${g.cover_image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${g.cover_image_url.replace(/^\/+/, "")}`
            )
          : imgs[0] || null;

        return { ...g, images: imgs, cover_image_url: cover };
      });

    res.json(addImages(games));
  } catch (err) {
    console.error("❌ Error searching games by title:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาชื่อเกม" });
  }
});

// ===================== GET /games/search-by-category =====================
router.get("/games/search-by-category", async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string || "").trim();

    if (!category || category === "All") {
      return res.status(400).json({ error: "กรุณาระบุประเภทเกมที่ต้องการค้นหา" });
    }

    const [games] = await db.query<RowDataPacket[]>(`
      SELECT g.id, g.title, g.price, g.description, g.release_date,
             c.name AS category, g.cover_image_url
      FROM game g
      JOIN category c ON g.category_id = c.id
      WHERE c.name = ?
      ORDER BY g.title ASC
    `, [category]);

    const gameIds = games.map(g => g.id);
    let images: RowDataPacket[] = [];
    if (gameIds.length > 0) {
      const [rows] = await db.query<RowDataPacket[]>(`
        SELECT * FROM game_image WHERE game_id IN (?)
      `, [gameIds]);
      images = rows;
    }

    const addImages = (games: RowDataPacket[]) =>
      games.map(g => {
        const imgs = images
          .filter(i => i.game_id === g.id)
          .map(i =>
            i.image_url.includes("uploads/")
              ? `${req.protocol}://${req.get("host")}/${i.image_url.replace(/^\/+/, "")}`
              : `${req.protocol}://${req.get("host")}/uploads/${i.image_url.replace(/^\/+/, "")}`
          );

        const cover = g.cover_image_url
          ? (
              g.cover_image_url.includes("uploads/")
                ? `${req.protocol}://${req.get("host")}/${g.cover_image_url.replace(/^\/+/, "")}`
                : `${req.protocol}://${req.get("host")}/uploads/${g.cover_image_url.replace(/^\/+/, "")}`
            )
          : imgs[0] || null;

        return { ...g, images: imgs, cover_image_url: cover };
      });

    res.json(addImages(games));
  } catch (err) {
    console.error("❌ Error searching games by category:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาตามประเภทเกม" });
  }
});


// ===================== GET /games/:id =====================
router.get("/games/:id", async (req: Request, res: Response) => {
  try {
    const gameId = parseInt(req.params.id, 10);

    if (isNaN(gameId)) {
      return res.status(400).json({ error: "ID เกมไม่ถูกต้อง" });
    }

    // ✅ ดึงข้อมูลเกมหลัก
    const [rows] = await db.query<RowDataPacket[]>(`
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
    const [images] = await db.query<RowDataPacket[]>(`
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
      ? (
          game.cover_image_url.includes("uploads/")
            ? `${req.protocol}://${req.get("host")}/${game.cover_image_url.replace(/^\/+/, "")}`
            : `${req.protocol}://${req.get("host")}/uploads/${game.cover_image_url.replace(/^\/+/, "")}`
        )
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

  } catch (err) {
    console.error("❌ Error getting game detail:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงรายละเอียดเกม" });
  }
});

router.get("/games/hot", async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT g.*, COUNT(pd.game_id) AS total_purchased
      FROM game g
      JOIN purchase_detail pd ON g.id = pd.game_id
      GROUP BY g.id
      ORDER BY total_purchased DESC
      LIMIT 10
    `);

    res.json({ success: true, hotGames: rows });
  } catch (err) {
    console.error("🔥 Error loading hot games:", err);
    res.status(500).json({ success: false, message: "โหลดเกมยอดฮิตล้มเหลว" });
  }
});

