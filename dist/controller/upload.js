"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const app_1 = require("firebase/app");
const storage_1 = require("firebase/storage");
const multer_1 = __importDefault(require("multer"));
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
const router = express_1.default.Router();
exports.router = router;
// Initialize Firebase
(0, app_1.initializeApp)(firebaseConfig);
const storage = (0, storage_1.getStorage)();
class FileMiddleware {
    constructor() {
        this.filename = "";
        this.diskLoader = (0, multer_1.default)({
            storage: multer_1.default.memoryStorage(),
            limits: {
                fileSize: 67108864, // 64 MByte
            },
        });
    }
}
const fileUpload = new FileMiddleware();
router.post("/", fileUpload.diskLoader.single("file"), async (req, res) => {
    try {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 10000);
        const storageRef = (0, storage_1.ref)(storage, `images/${uniqueSuffix}.${req.file.originalname.split(".").pop()}`);
        const metadata = {
            contentType: req.file.mimetype,
        };
        const snapshot = await (0, storage_1.uploadBytesResumable)(storageRef, req.file.buffer, metadata);
        const downloadUrl = await (0, storage_1.getDownloadURL)(snapshot.ref);
        res.json({ filename: downloadUrl });
    }
    catch (err) {
        console.log(err);
        res.send(err);
    }
});
//# sourceMappingURL=upload.js.map