import express from "express"; 
import multer from "multer";
import { initializeApp } from "firebase/app";
import { getStorage, ref, getDownloadURL, uploadBytesResumable } from "firebase/storage";

// ✅ Firebase Config (เช็ก bucket name ให้ตรง)
const firebaseConfig = {
  apiKey: "AIzaSyC7qVqJRKMVK3rPWEGX3RknQ6vS7wn87dI",
  authDomain: "game-store-26fdf.firebaseapp.com",
  projectId: "game-store-26fdf",
  storageBucket: "game-store-26fdf.firebasestorage.app",
  messagingSenderId: "98541783499",
  appId: "1:98541783499:web:87ab4918d25e2041068e4e",
  measurementId: "G-ZZVSW047MJ"
};

// ✅ Initialize Firebase
initializeApp(firebaseConfig);
const storage = getStorage();

const router = express.Router();

// ✅ ใช้ memoryStorage สำหรับอัปโหลดขึ้น Firebase เท่านั้น
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024 } // 64MB
});

// ✅ API Upload ไฟล์ไป Firebase
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "ไม่มีไฟล์ส่งมา" });

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 10000);
    const ext = req.file.originalname.split(".").pop();
    const storageRef = ref(storage, `games/${uniqueSuffix}.${ext}`);

    const metadata = { contentType: req.file.mimetype };
    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);

    const downloadUrl = await getDownloadURL(snapshot.ref);
    res.json({ url: downloadUrl }); // ✅ ส่ง URL กลับไปเก็บใน DB ได้เลย
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "อัปโหลดล้มเหลว" });
  }
});
// Initialize Firebase



export default router;
