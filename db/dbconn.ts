import express from "express";
import * as os from "os";

const db = express();
db.use(express.json());

// ✅ ไม่ต้องเปิดพอร์ตเองใน Vercel
// ❌ ห้ามใช้ app.listen()

// ✅ ตัวอย่าง route หลัก
db.get("/", (req, res) => {
  // หาค่า IP ของเครื่อง (แค่เพื่อ debug เฉย ๆ)
  let address = "0.0.0.0";
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((interfaceName) => {
    interfaces[interfaceName]?.forEach((interfaceInfo) => {
      if (interfaceInfo.family === "IPv4" && !interfaceInfo.internal) {
        address = interfaceInfo.address;
      }
    });
  });

  res.json({
    message: "Database API is running on Vercel 🚀",
    host: address,
  });
});

export default db;
