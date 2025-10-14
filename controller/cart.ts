import { Router, Request, Response } from "express";
import { db } from "../db/dbconn";
import { RowDataPacket } from "mysql2";
import { ResultSetHeader } from "mysql2";

export const router = Router();

/** 
 * ===========================
 * ✅ โหลดตะกร้าจากฐานข้อมูล
 * ===========================
 */
router.get("/cart/:userId", async (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId);
  if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT g.id, g.title, g.price, g.cover_image_url
       FROM cart c
       JOIN game g ON c.game_id = g.id
       WHERE c.user_id = ?`,
      [userId]
    );

    res.json({ success: true, cart: rows });
  } catch (err) {
    console.error("❌ โหลดตะกร้าผิดพลาด:", err);
    res.status(500).json({ success: false, message: "โหลดตะกร้าล้มเหลว" });
  }
});

/**
 * ===========================
 * ✅ เพิ่มเกมลงตะกร้า
 * ===========================
 */
router.post("/cart/add", async (req: Request, res: Response) => {
  const { userId, gameId } = req.body;
  if (!userId || !gameId)
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });

  try {
    // ตรวจว่ามีอยู่แล้วหรือไม่
    const [check] = await db.query<RowDataPacket[]>(
      "SELECT * FROM cart WHERE user_id = ? AND game_id = ?",
      [userId, gameId]
    );
    if (check.length > 0)
      return res.json({ success: false, message: "มีเกมนี้ในตะกร้าแล้ว" });

    // เพิ่มใหม่
    await db.query("INSERT INTO cart (user_id, game_id) VALUES (?, ?)", [userId, gameId]);

    // โหลด cart ใหม่
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT g.id, g.title, g.price, g.cover_image_url
       FROM cart c
       JOIN game g ON c.game_id = g.id
       WHERE c.user_id = ?`,
      [userId]
    );

    res.json({ success: true, cart: rows });
  } catch (err) {
    console.error("❌ เพิ่มเกมลงตะกร้าผิดพลาด:", err);
    res.status(500).json({ success: false, message: "เพิ่มเกมไม่สำเร็จ" });
  }
});

/**
 * ===========================
 * ✅ ลบเกมออกจากตะกร้า
 * ===========================
 */
router.delete("/cart/remove/:gameId", async (req: Request, res: Response) => {
  const userId = parseInt(req.query.userId as string);
  const gameId = parseInt(req.params.gameId);
  if (!userId || !gameId)
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });

  try {
    await db.query("DELETE FROM cart WHERE user_id = ? AND game_id = ?", [userId, gameId]);

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT g.id, g.title, g.price, g.cover_image_url
       FROM cart c
       JOIN game g ON c.game_id = g.id
       WHERE c.user_id = ?`,
      [userId]
    );

    res.json({ success: true, cart: rows });
  } catch (err) {
    console.error("❌ ลบเกมจากตะกร้าผิดพลาด:", err);
    res.status(500).json({ success: false, message: "ลบเกมไม่สำเร็จ" });
  }
});

/**
 * ===========================
 * ✅ Checkout — หักเงิน + ย้ายเกมเข้าคลัง + ล้างตะกร้า
 * ===========================
 */
/** ✅ Checkout */
// router.post("/cart/checkout", async (req: Request, res: Response) => {
//   const { userId, totalCost } = req.body;

//   if (!userId || totalCost === undefined)
//     return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });

//   try {
//     // 1️⃣ ตรวจสอบเงินใน wallet
//     const [user] = await db.query("SELECT wallet_balance FROM user_account WHERE id = ?", [userId]);
//     const balance = (user as any)[0]?.wallet_balance || 0;
//     if (balance < totalCost) {
//       return res.json({ success: false, message: "ยอดเงินไม่พอใน Wallet" });
//     }

//     // 2️⃣ ดึงเกมทั้งหมดในตะกร้า
//     const [cartGames] = await db.query(
//       "SELECT game_id FROM cart WHERE user_id = ?",
//       [userId]
//     );

//     // 3️⃣ บันทึกลงตาราง library
//     for (const g of cartGames as any[]) {
//       await db.query(
//         "INSERT INTO user_library (user_id, game_id) VALUES (?, ?)",
//         [userId, g.game_id]
//       );
//     }

//     // 4️⃣ ลบออกจาก cart
//     await db.query("DELETE FROM cart WHERE user_id = ?", [userId]);

//     // 5️⃣ ตัดเงิน
//     const newBalance = balance - totalCost;
//     await db.query("UPDATE user_account SET wallet_balance = ? WHERE id = ?", [newBalance, userId]);

//     return res.json({
//       success: true,
//       message: "ซื้อสำเร็จ",
//       newBalance
//     });
//   } catch (err) {
//     console.error("❌ Checkout Error:", err);
//     res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
//   }
// });

/** ✅ ดึงคลังเกมของผู้ใช้ */
router.get("/library/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // ดึงเกมและรูปเสริม (ถ้ามี)
    const [rows] = await db.query<any[]>(`
      SELECT g.id, g.title, g.price, g.category_id, g.cover_image_url, g.description
      FROM user_library ul
      JOIN game g ON ul.game_id = g.id
      WHERE ul.user_id = ?
    `, [userId]);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // สำหรับแต่ละเกม
    const games = await Promise.all(rows.map(async game => {
      // ดึงรูปเสริมจาก game_image
      const [images] = await db.query<any[]>(
        `SELECT image_url FROM game_image WHERE game_id = ?`,
        [game.id]
      );

      // map image list ให้เป็น URL เต็ม
      const imageList = images.map(img => {
        const path = img.image_url.includes("uploads/")
          ? `${baseUrl}/${img.image_url.replace(/^\/+/, "")}`
          : `${baseUrl}/uploads/${img.image_url.replace(/^\/+/, "")}`;
        return path;
      });

      // ปรับ cover image
      const cover = game.cover_image_url
        ? (game.cover_image_url.includes("uploads/")
          ? `${baseUrl}/${game.cover_image_url.replace(/^\/+/, "")}`
          : `${baseUrl}/uploads/${game.cover_image_url.replace(/^\/+/, "")}`)
        : imageList[0] || null;

      return {
        ...game,
        image: cover,
        images: imageList
      };
    }));

    res.json({ success: true, games });
  } catch (err) {
    console.error("❌ โหลดคลังเกมล้มเหลว:", err);
    res.status(500).json({ success: false, message: "ไม่สามารถโหลดคลังเกมได้" });
  }
});

/** ✅ ดึงประวัติการซื้อเกม + wallet */
router.get("/wallet/history/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // ดึง wallet transactions
    const [walletTx] = await db.query<any[]>(
      "SELECT type, amount, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    // ดึงเกมที่ซื้อ
    const [gameTx] = await db.query<any[]>(
      `SELECT g.title AS type, g.price AS amount, ul.purchased_at AS created_at
       FROM user_library ul
       JOIN game g ON ul.game_id = g.id
       WHERE ul.user_id = ?
       ORDER BY ul.purchased_at DESC`,
      [userId]
    );

    // รวมประวัติทั้งหมด
    const transactions = [...walletTx, ...gameTx].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({ success: true, transactions });
  } catch (err) {
    console.error("❌ โหลดประวัติธุรกรรมล้มเหลว:", err);
    res.status(500).json({ success: false, message: "ไม่สามารถโหลดประวัติได้" });
  }
});

router.post("/cart/checkout", async (req: Request, res: Response) => {
  const { userId, totalCost, discountCode } = req.body;
  if (!userId || totalCost === undefined)
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบ" });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 🔹 ดึงเกมจากตะกร้า
    const [cartItems]: any = await connection.query(
      "SELECT game_id FROM cart WHERE user_id = ?",
      [userId]
    );
    if (cartItems.length === 0)
      return res.json({ success: false, message: "ตะกร้าว่าง" });

    // 1️⃣ ตรวจสอบเงินใน wallet
    const [user]: any = await connection.query(
      "SELECT wallet_balance FROM user_account WHERE id = ?",
      [userId]
    );
    const balance = user[0]?.wallet_balance || 0;
    if (balance < totalCost) {
      await connection.rollback();
      return res.json({ success: false, message: "ยอดเงินไม่พอใน Wallet" });
    }

    // 2️⃣ ตรวจสอบโค้ดส่วนลด (ถ้ามี)
    let discountData: any = null;
    if (discountCode) {
      const [codes]: any = await connection.query(
        "SELECT * FROM Discount_code WHERE code_id = ?",
        [discountCode.trim()]
      );
      discountData = codes[0];
      if (!discountData) {
        await connection.rollback();
        return res.json({ success: false, message: "ไม่พบโค้ดส่วนลดนี้" });
      }

      // ตรวจสอบสิทธิ์การใช้งาน
      const [used]: any = await connection.query(
        "SELECT * FROM user_used_code WHERE user_id = ? AND code_id = ?",
        [userId, discountData.id]
      );
      if (used.length > 0) {
        await connection.rollback();
        return res.json({ success: false, message: "คุณได้ใช้โค้ดนี้แล้ว" });
      }
      if (discountData.use_code >= discountData.max_use) {
        await connection.rollback();
        return res.json({ success: false, message: "โค้ดนี้หมดสิทธิ์ใช้งานแล้ว" });
      }
    }

    // 3️⃣ เพิ่มข้อมูล purchase
    const [purchaseResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO purchase (user_id, total_amount, discount_code, final_amount)
       VALUES (?, ?, ?, ?)`,
      [userId, totalCost, discountCode || null, totalCost]
    );
    const purchaseId = purchaseResult.insertId;

    // 4️⃣ เพิ่มข้อมูล purchase_detail + ยอดขายเกม
    for (const item of cartItems) {
      await connection.query(
        `INSERT INTO purchase_detail (purchase_id, game_id, quantity)
         VALUES (?, ?, 1)`,
        [purchaseId, item.game_id]
      );

      // เพิ่มยอดขายเกม
      await connection.query(
        "UPDATE game SET sold_count = sold_count + 1 WHERE id = ?",
        [item.game_id]
      );
    }

    // 5️⃣ เพิ่มเข้า Library
    for (const g of cartItems) {
      await connection.query(
        "INSERT INTO user_library (user_id, game_id) VALUES (?, ?)",
        [userId, g.game_id]
      );
    }

    // 6️⃣ ล้างตะกร้า
    await connection.query("DELETE FROM cart WHERE user_id = ?", [userId]);

    // 7️⃣ ตัดเงินออกจาก Wallet
    const newBalance = balance - totalCost;
    await connection.query(
      "UPDATE user_account SET wallet_balance = ? WHERE id = ?",
      [newBalance, userId]
    );

    // 8️⃣ จัดการโค้ดส่วนลด
    if (discountData) {
      await connection.query(
        "UPDATE Discount_code SET use_code = use_code + 1 WHERE id = ?",
        [discountData.id]
      );
      await connection.query(
        "INSERT INTO user_used_code (user_id, code_id) VALUES (?, ?)",
        [userId, discountData.id]
      );
      const [check]: any = await connection.query(
        "SELECT use_code, max_use FROM Discount_code WHERE id = ?",
        [discountData.id]
      );
      if (check[0].use_code >= check[0].max_use) {
        await connection.query("DELETE FROM Discount_code WHERE id = ?", [discountData.id]);
      }
    }

    await connection.commit();
    return res.json({ success: true, message: "✅ ซื้อสำเร็จ", newBalance });
  } catch (err) {
    await connection.rollback();
    console.error("❌ Checkout Error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในระบบ" });
  } finally {
    connection.release();
  }
});
