import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import errorHandler from "./middleware/errorHandler.js";
import adminRoutes from "./routes/adminRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import disputeRoutes from "./routes/disputeRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import rentalRoutes from "./routes/rentalRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.join(__dirname, "..", "..", "frontend", "dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);
const envOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...envOrigins,
]);
const isLocalDevOrigin = (origin) =>
  /^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin);

app.use(
  helmet({
    // Allow the frontend to render uploaded item media from the backend origin.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (no Origin) and known frontend origins.
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
  })
);

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (_req, res) => {
  if (hasFrontendBuild) {
    return res.sendFile(frontendIndexPath);
  }

  res.status(200).json({
    status: "success",
    message: "Borrowly API is running.",
    health: "/health",
  });
});

// Browsers auto-request favicon.ico; return no-content to avoid noisy 404 logs.
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "success", message: "Borrowly API is healthy." });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/rentals", rentalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));
  app.get("*", (req, res, next) => {
    if (req.originalUrl.startsWith("/api")) {
      return next();
    }
    return res.sendFile(frontendIndexPath);
  });
}

app.use((req, res) => {
  res.status(404).json({
    status: "fail",
    message: `Route not found: ${req.originalUrl}`,
  });
});

app.use(errorHandler);

export default app;
