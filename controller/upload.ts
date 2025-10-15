import express from "express"; 
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import multer from "multer";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7qVqJRKMVK3rPWEGX3RknQ6vS7wn87dI",
  authDomain: "game-store-26fdf.firebaseapp.com",
  projectId: "game-store-26fdf",
  storageBucket: "game-store-26fdf.firebasestorage.app",
  messagingSenderId: "98541783499",
  appId: "1:98541783499:web:87ab4918d25e2041068e4e",
  measurementId: "G-ZZVSW047MJ"
};

const router = express.Router();

// Initialize Firebase
initializeApp(firebaseConfig);
const storage = getStorage();

class FileMiddleware {
  filename = "";
  public readonly diskLoader = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 67108864, // 64 MByte
    },
  });
}

const fileUpload = new FileMiddleware();
router.post("/", fileUpload.diskLoader.single("file"), async (req, res) => {
  try {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 10000);
    const storageRef = ref(
      storage,
      `images/${uniqueSuffix}.${req.file!.originalname.split(".").pop()}`
    );
    const metadata = {
      contentType: req.file!.mimetype,
    };
    const snapshot = await uploadBytesResumable(
      storageRef,
      req.file!.buffer,
      metadata
    );
    const downloadUrl = await getDownloadURL(snapshot.ref);
    res.json({ filename: downloadUrl });
  } catch (err) {
    console.log(err);
    res.send(err);
  }
});


export default router;
