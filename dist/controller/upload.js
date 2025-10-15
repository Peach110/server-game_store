"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
exports.router = express_1.default.Router();
const uploadPath = path_1.default.join(__dirname, "../uploads");
if (!fs_1.default.existsSync(uploadPath))
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadPath),
    filename: (_req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 10000) + path_1.default.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({ storage, limits: { fileSize: 64 * 1024 * 1024 } });
exports.router.post("/", upload.single("file"), (req, res) => {
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: "ไม่มีไฟล์ส่งมา" });
    res.json({ filename: file.filename }); // ส่งเฉพาะชื่อไฟล์
});
//# sourceMappingURL=upload.js.map