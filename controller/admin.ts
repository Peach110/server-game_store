import { Router, Request, Response } from "express";
import { db } from "../db/dbconn";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

export const router = Router();
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// ============================
// 📂 ตั้งค่าการอัปโหลดรูปภาพ
// ============================
const uploadPath = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// ===================================================
// 🟢 1. เพิ่มเกมใหม่ + อัปโหลดรูป
// ===================================================
// Route เพิ่มเกม
router.post("/addgame",
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "images", maxCount: 5 }
  ]),
  async (req: Request, res: Response) => {
    const { title, price, category_id, description } = req.body;

    if (!title || !category_id || !req.files) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
    }

    try {
      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      // ดึง cover image
      const coverFile = files.cover_image?.[0];
      if (!coverFile) {
        return res.status(400).json({ message: "กรุณาอัปโหลดรูปหน้าปก" });
      }
      const cover_image_url = coverFile.filename.trim();

      // เพิ่มเกม
      const [result]: any = await db.query(
        "INSERT INTO game (title, price, category_id, description, cover_image_url) VALUES (?, ?, ?, ?, ?)",
        [title.trim(), price, category_id, description?.trim(), cover_image_url]
      );
      const gameId = result.insertId;

      // ดึงรูปอื่นๆ
      const imagesFiles = files.images || [];
      const images = imagesFiles.map(f => f.filename.trim());

      for (const img of images) {
        await db.query("INSERT INTO game_image (game_id, image_url) VALUES (?, ?)", [gameId, img]);
      }

      // ส่ง path เต็มให้ frontend
      const fullPaths = images.map(img => `/uploads/${img}`);

      res.json({
        message: "เพิ่มเกมสำเร็จ",
        gameId,
        cover_image_url: `/uploads/${cover_image_url}`,
        images: fullPaths
      });
    } catch (err) {
      console.error("❌ เพิ่มเกมล้มเหลว:", err);
      res.status(500).json({ message: "เพิ่มเกมล้มเหลว" });
    }
  });

// ===================================================
// 🟡 2. ดึงเกมทั้งหมด (หน้า Admin)
// ===================================================
router.get("/allgames", async (_req: Request, res: Response) => {
  try {
    const [games]: any = await db.query(`
      SELECT 
        g.id,
        g.title,
        g.price,
        g.category_id,
        c.name AS category_name,
        g.description,
        g.release_date,
        g.cover_image_url,
        g.sold_count
      FROM game g
      JOIN category c ON g.category_id = c.id
      ORDER BY g.sold_count DESC, g.release_date DESC
    `);

    const [images]: any = await db.query("SELECT * FROM game_image");

    const result = games.map((g: any) => {
      const gameImages = images
        .filter((img: any) => img.game_id === g.id)
        .map((img: any) => `/uploads/${img.image_url.trim()}`);

      const coverPath = g.cover_image_url
        ? `/uploads/${path.basename(g.cover_image_url.trim())}`
        : gameImages.length > 0
          ? gameImages[0]
          : null;

      return {
        id: g.id,
        name: g.title.trim(),
        price: g.price,
        category: g.category_name, // ✅ แสดงชื่อประเภทตรงนี้
        description: g.description?.trim(),
        releaseDate: g.release_date,
        sold_count: g.sold_count, // ✅ เพิ่มยอดขายในผลลัพธ์
        cover_image_url: coverPath,
        images: gameImages,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ โหลดข้อมูลเกมล้มเหลว:", err);
    res.status(500).json({ message: "โหลดข้อมูลเกมล้มเหลว" });
  }
});


// ===================================================
// 🟣 3. แก้ไขข้อมูลเกม
// ===================================================
router.put("/editgame/:id", upload.array("images", 5), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, description, cover_image_url } = req.body;
  const files = req.files as Express.Multer.File[];

  try {
    // ✅ อัปเดตข้อมูลเกม (ไม่แตะรูปภาพ)
    await db.query(
      "UPDATE game SET title=?, price=?, category_id=?, description=? WHERE id=?",
      [name?.trim(), price, category, description?.trim(), id]
    );

    // ✅ ถ้ามีการอัปโหลดรูปใหม่ → ลบรูปเก่าออกและเพิ่มรูปใหม่
    if (files && files.length > 0) {
      // ดึงชื่อไฟล์เก่าก่อนจะลบ
      const [oldImages]: any = await db.query("SELECT image_url FROM game_image WHERE game_id=?", [id]);

      // ลบรูปเก่าออกจากโฟลเดอร์ /uploads
      oldImages.forEach((img: any) => {
        const imgPath = path.join(__dirname, "../uploads", img.image_url);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });

      // ลบ record เก่าจาก DB
      await db.query("DELETE FROM game_image WHERE game_id=?", [id]);

      // เพิ่มรูปใหม่ใน DB
      const newImages = files.map(f => f.filename.trim());
      for (const img of newImages) {
        await db.query("INSERT INTO game_image (game_id, image_url) VALUES (?, ?)", [id, img]);
      }
    }

    res.json({ message: "✅ แก้ไขข้อมูลเกมสำเร็จ และบันทึกถาวรแล้ว" });
  } catch (err) {
    console.error("❌ แก้ไขข้อมูลเกมล้มเหลว:", err);
    res.status(500).json({ message: "❌ แก้ไขข้อมูลเกมล้มเหลว" });
  }
});


// 🔴 4. ลบเกม
// ===================================================
router.delete("/deletegame/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // ลบข้อมูลที่อ้างถึงเกมใน user_library ก่อน
    await db.query("DELETE FROM user_library WHERE game_id=?", [id]);
    await db.query("DELETE FROM game_image WHERE game_id=?", [id]);
    await db.query("DELETE FROM game WHERE id=?", [id]);
    res.json({ message: "ลบเกมสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบเกมล้มเหลว:", err);
    res.status(500).json({ message: "ลบเกมล้มเหลว" });
  }
});

// 🔹 ดึงรายชื่อผู้ใช้ทั้งหมด
router.get("/users", async (_req: Request, res: Response) => {
  try {
    const [users] = await db.query(
      `SELECT id, username AS name, email FROM user_account ORDER BY id`
    );
    res.json({ success: true, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

// ✅ ดึงประวัติธุรกรรม (เติมเงิน + ซื้อเกม)
router.get("/user/:id/transactions", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id);
  if (!userId) return res.status(400).json({ success: false, message: "user_id ไม่ถูกต้อง" });

  try {
    // ✅ ข้อมูล user
    const [users] = await db.query(
      `SELECT id, username AS name, email, wallet_balance 
       FROM user_account WHERE id = ?`,
      [userId]
    );

    if ((users as any[]).length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    }

    const user = (users as any[])[0];

    // ✅ 1. ประวัติเติมเงิน
    const [walletTransactions] = await db.query(
      `SELECT id, 'เติมเงิน' AS type, amount, created_at AS date
       FROM wallet_transactions 
       WHERE user_id = ?`,
      [userId]
    );

    // ✅ 2. ประวัติซื้อเกมจาก purchase + game
    const [gamePurchases] = await db.query(
      `SELECT ul.id, 'ซื้อเกม' AS type, g.price AS amount, p.created_at AS date, g.title AS game_name
   FROM user_library ul
   JOIN game g ON ul.game_id = g.id
   JOIN purchase p ON p.user_id = ul.user_id
   WHERE ul.user_id = ?`,
      [userId]
    );


    // ✅ รวมข้อมูลทั้งสองแบบ
    const transactions = [
      ...(walletTransactions as any[]),
      ...(gamePurchases as any[])
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, user: { ...user, transactions } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

/** ดึงโค้ดทั้งหมด */
router.get("/allcodes", async (req: Request, res: Response) => {
  try {
    const [rows]: any = await db.query("SELECT * FROM Discount_code ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    console.error("❌ ดึงข้อมูลโค้ดล้มเหลว:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

/** เพิ่มโค้ดใหม่ */
router.post("/addcodes", async (req: Request, res: Response) => {
  const { code_id, price, max_use, discount_persen } = req.body;
  if (!code_id || !max_use) return res.status(400).json({ message: "กรุณากรอก code_id และ max_use ให้ครบ" });

  try {
    const [result]: any = await db.query(
      `INSERT INTO Discount_code (code_id, price, max_use, use_code, discount_persen) VALUES (?, ?, ?, ?, ?)`,
      [code_id.trim(), price || 0, max_use, 0, discount_persen || 0]
    );

    res.json({ message: "✅ เพิ่มโค้ดสำเร็จ", id: result.insertId });
  } catch (err) {
    console.error("❌ เพิ่มโค้ดล้มเหลว:", err);
    res.status(500).json({ message: "เพิ่มโค้ดล้มเหลว" });
  }
});

/** แก้ไขโค้ด */
router.put("/editcode/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { code_id, price, max_use, discount_persen } = req.body;

  if (!code_id || !max_use) return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

  try {
    await db.query(
      "UPDATE Discount_code SET code_id=?, price=?, max_use=?, discount_persen=? WHERE id=?",
      [code_id.trim(), price || 0, max_use, discount_persen || 0, id]
    );
    res.json({ message: "✅ แก้ไขโค้ดสำเร็จ" });
  } catch (err) {
    console.error("❌ แก้ไขโค้ดล้มเหลว:", err);
    res.status(500).json({ message: "แก้ไขโค้ดล้มเหลว" });
  }
});

/** ลบโค้ด */
router.delete("/deletecode/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM Discount_code WHERE id=?", [id]);
    res.json({ message: "🗑️ ลบโค้ดสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบโค้ดล้มเหลว:", err);
    res.status(500).json({ message: "ลบโค้ดล้มเหลว" });
  }
});