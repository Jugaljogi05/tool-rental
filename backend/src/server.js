import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import connectDB from "./config/db.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const PORT = Number(process.env.PORT || 5001);
const SKIP_DB = `${process.env.SKIP_DB || "false"}`.toLowerCase() === "true";

const bootstrap = async () => {
  if (!SKIP_DB) {
    await connectDB();
  } else {
    // eslint-disable-next-line no-console
    console.warn("SKIP_DB=true, starting server without MongoDB connection.");
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Borrowly backend running on http://localhost:${PORT}`);
  });
};

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
