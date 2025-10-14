import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";

import { router as cart } from "./controller/cart";
import { router as wallet } from "./controller/wallet";
import { router as index } from "./controller/index";
import { router as users } from "./controller/user";
import { router as upload } from "./controller/upload";
import { router as games } from "./controller/games";
import { router as admin } from "./controller/admin";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static folder
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/upload", upload);
app.use("/", cart);
app.use("/", wallet);
app.use("/", games);
app.use("/", admin);
app.use("/", index);
app.use("/", users);

export default app;
