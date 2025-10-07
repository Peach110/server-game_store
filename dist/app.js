"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const index_1 = require("./controller/index");
const user_1 = require("./controller/user");
const upload_1 = require("./controller/upload");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(body_parser_1.default.text());
app.use(body_parser_1.default.json());
// Routes
app.use("/", index_1.router);
app.use("/", user_1.router);
app.use("/upload", upload_1.router);
// Static uploads (ให้ Render เสิร์ฟไฟล์จากโฟลเดอร์ uploads)
app.use("/uploads", express_1.default.static("uploads"));
// ✅ export แบบ default เพื่อใช้ใน server.ts ได้
exports.default = app;
//# sourceMappingURL=app.js.map