import express, { Request, Response } from "express";
import multer from "multer";
import admin from "firebase-admin";
import path from "path";
import { db } from "../db/dbconn"; // ตามโครงโปรเจกต์คุณ
import fs from "fs";

const router = express.Router();

// -----------------------------
// ✅ Init Firebase Admin
// -----------------------------
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../serviceAccountKey.json"), "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "game-store-26fdf.appspot.com" // <-- แก้ให้ตรงกับของคุณ
});

const bucket = admin.storage().bucket();

// -----------------------------
// ✅ Multer memory storage
// -----------------------------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 } // 64 MB
});

// -----------------------------
// Helper: upload buffer to Firebase Storage and make public
// returns public URL
// -----------------------------
async function uploadBufferToFirebase(buffer: Buffer, destinationPath: string, contentType: string) {
  const file = bucket.file(destinationPath);
  await file.save(buffer, {
    metadata: {
      contentType,
      // optional: cacheControl: "public, max-age=31536000"
    },
    resumable: false,
  });

  // Make public (so URL is accessible directly). Alternative: generate signed URL.
  await file.makePublic();

  // public URL:
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(destinationPath)}`;
}

// -----------------------------
// 1) เพิ่มเกมใหม่ (อัปโหลดรูปขึ้น Firebase เองแล้วเก็บ URL ลง DB)
// -----------------------------
router.post(
  "/addgame",
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "images", maxCount: 5 }
  ]),
  async (req: Request, res: Response) => {
    const { title, price, category_id, description } = req.body;
    if (!title || !category_id) {
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });
    }

    try {
      // files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // cover
      if (!files?.cover_image || files.cover_image.length === 0) {
        return res.status(400).json({ message: "กรุณาอัปโหลดรูปหน้าปก" });
      }

      // upload cover to Firebase
      const coverFile = files.cover_image[0];
      const coverExt = path.extname(coverFile.originalname) || "";
      const coverDestination = `games/covers/${Date.now()}-${Math.round(Math.random()*10000)}${coverExt}`;
      const coverUrl = await uploadBufferToFirebase(coverFile.buffer, coverDestination, coverFile.mimetype);

      // insert game row, store coverUrl
      const [result]: any = await db.query(
        "INSERT INTO game (title, price, category_id, description, cover_image_url) VALUES (?, ?, ?, ?, ?)",
        [title.trim(), price || 0, category_id, description?.trim() || null, coverUrl]
      );
      const gameId = result.insertId;

      // other images (optional)
      const imageFiles = files?.images || [];
      const imageUrls: string[] = [];
      for (const f of imageFiles) {
        const ext = path.extname(f.originalname) || "";
        const dest = `games/images/${Date.now()}-${Math.round(Math.random()*10000)}${ext}`;
        const url = await uploadBufferToFirebase(f.buffer, dest, f.mimetype);
        imageUrls.push(url);
        await db.query("INSERT INTO game_image (game_id, image_url) VALUES (?, ?)", [gameId, url]);
      }

      res.json({
        message: "เพิ่มเกมสำเร็จ",
        gameId,
        cover_image_url: coverUrl,
        images: imageUrls
      });
    } catch (err) {
      console.error("❌ เพิ่มเกมล้มเหลว:", err);
      res.status(500).json({ message: "เพิ่มเกมล้มเหลว", error: String(err) });
    }
  }
);

// -----------------------------
// 2) ดึงเกมทั้งหมด (Admin) — ส่ง URL จาก DB ตรงๆ
// -----------------------------
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
        .map((img: any) => img.image_url.trim()); // already full URL

      const coverPath = g.cover_image_url ? g.cover_image_url.trim() : (gameImages.length > 0 ? gameImages[0] : null);

      return {
        id: g.id,
        name: g.title.trim(),
        price: g.price,
        category: g.category_name,
        description: g.description?.trim(),
        releaseDate: g.release_date,
        sold_count: g.sold_count,
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

// -----------------------------
// 3) แก้ไขเกม — ถ้ามีไฟล์ใหม่ให้ upload ขึ้น Firebase และลบไฟล์เก่า
// -----------------------------
router.put("/editgame/:id", upload.fields([{ name: "cover_image", maxCount: 1 }, { name: "images", maxCount: 5 }]), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, description } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  try {
    // อัปเดตข้อมูลทั่วไป
    await db.query("UPDATE game SET title=?, price=?, category_id=?, description=? WHERE id=?", [
      name?.trim(), price || 0, category, description?.trim() || null, id
    ]);

    // หากมี cover ใหม่ -> ลบ cover เก่า (จาก Firebase) แล้วอัปโหลดใหม่
    if (files?.cover_image && files.cover_image.length > 0) {
      // ดึงชื่อ cover เก่า
      const [rows]: any = await db.query("SELECT cover_image_url FROM game WHERE id=?", [id]);
      const oldCoverUrl = rows[0]?.cover_image_url;
      if (oldCoverUrl) {
        // extract path after bucket host: https://storage.googleapis.com/<bucket>/<path>
        const parts = oldCoverUrl.split(`/${bucket.name}/`);
        if (parts.length === 2) {
          const oldPath = decodeURIComponent(parts[1]);
          try { await bucket.file(oldPath).delete(); } catch(e) { console.warn("ลบ cover เก่าไม่สำเร็จ:", e); }
        }
      }

      // upload new cover
      const c = files.cover_image[0];
      const ext = path.extname(c.originalname) || "";
      const coverDest = `games/covers/${Date.now()}-${Math.round(Math.random()*10000)}${ext}`;
      const coverUrl = await uploadBufferToFirebase(c.buffer, coverDest, c.mimetype);
      await db.query("UPDATE game SET cover_image_url=? WHERE id=?", [coverUrl, id]);
    }

    // หากมี images ใหม่ -> ลบ images เก่า ทั้งหมด แล้วเพิ่มใหม่
    if (files?.images && files.images.length > 0) {
      const [oldImgs]: any = await db.query("SELECT image_url FROM game_image WHERE game_id=?", [id]);
      for (const r of oldImgs) {
        const url = r.image_url;
        const parts = url.split(`/${bucket.name}/`);
        if (parts.length === 2) {
          const oldPath = decodeURIComponent(parts[1]);
          try { await bucket.file(oldPath).delete(); } catch(e) { console.warn("ลบ image เก่าไม่สำเร็จ:", e); }
        }
      }

      await db.query("DELETE FROM game_image WHERE game_id=?", [id]);

      // upload new images and insert
      for (const f of files.images) {
        const ext = path.extname(f.originalname) || "";
        const dest = `games/images/${Date.now()}-${Math.round(Math.random()*10000)}${ext}`;
        const imgUrl = await uploadBufferToFirebase(f.buffer, dest, f.mimetype);
        await db.query("INSERT INTO game_image (game_id, image_url) VALUES (?, ?)", [id, imgUrl]);
      }
    }

    res.json({ message: "แก้ไขเกมสำเร็จ" });
  } catch (err) {
    console.error("❌ แก้ไขเกมล้มเหลว:", err);
    res.status(500).json({ message: "แก้ไขเกมล้มเหลว", error: String(err) });
  }
});

// -----------------------------
// 4) ลบเกม — ลบ record และไฟล์ใน Firebase
// -----------------------------
router.delete("/deletegame/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // ลบ images ใน Firebase
    const [imgs]: any = await db.query("SELECT image_url FROM game_image WHERE game_id=?", [id]);
    for (const r of imgs) {
      const url = r.image_url;
      const parts = url.split(`/${bucket.name}/`);
      if (parts.length === 2) {
        const oldPath = decodeURIComponent(parts[1]);
        try { await bucket.file(oldPath).delete(); } catch(e) { console.warn("ลบไฟล์ภาพไม่สำเร็จ:", e); }
      }
    }

    // ลบ cover ใน Firebase
    const [gameRows]: any = await db.query("SELECT cover_image_url FROM game WHERE id=?", [id]);
    const coverUrl = gameRows[0]?.cover_image_url;
    if (coverUrl) {
      const parts = coverUrl.split(`/${bucket.name}/`);
      if (parts.length === 2) {
        const oldPath = decodeURIComponent(parts[1]);
        try { await bucket.file(oldPath).delete(); } catch(e) { console.warn("ลบ cover ไม่สำเร็จ:", e); }
      }
    }

    // ลบจาก DB
    await db.query("DELETE FROM user_library WHERE game_id=?", [id]);
    await db.query("DELETE FROM game_image WHERE game_id=?", [id]);
    await db.query("DELETE FROM game WHERE id=?", [id]);

    res.json({ message: "ลบเกมสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบเกมล้มเหลว:", err);
    res.status(500).json({ message: "ลบเกมล้มเหลว", error: String(err) });
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