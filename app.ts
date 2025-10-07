import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { router as index } from "./controller/index";
import { router as users } from "./controller/user";
import { router as upload } from "./controller/upload";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.text());
app.use(bodyParser.json());

// Routes
app.use("/", index);
app.use("/", users);
app.use("/upload", upload);

// Static uploads folder
app.use("/uploads", express.static("uploads"));

export default app;
