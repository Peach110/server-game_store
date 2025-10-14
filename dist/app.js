"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const path_1 = __importDefault(require("path"));
const cart_1 = require("./controller/cart");
const wallet_1 = require("./controller/wallet");
const index_1 = require("./controller/index");
const user_1 = require("./controller/user");
const upload_1 = require("./controller/upload");
const games_1 = require("./controller/games");
const admin_1 = require("./controller/admin");
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Static folder
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
// Routes
app.use("/upload", upload_1.router);
app.use("/", cart_1.router);
app.use("/", wallet_1.router);
app.use("/", games_1.router);
app.use("/", admin_1.router);
app.use("/", index_1.router);
app.use("/", user_1.router);
exports.default = app;
//# sourceMappingURL=app.js.map