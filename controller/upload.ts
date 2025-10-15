import express from "express"; 
import path from "path";
import multer from "multer";
import fs from "fs";

export const router = express.Router();

const uploadPath = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 10000) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage, limits: { fileSize: 64 * 1024 * 1024 } });

router.post("/", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "ไม่มีไฟล์ส่งมา" });
  res.json({ filename: file.filename }); // ส่งเฉพาะชื่อไฟล์
});
