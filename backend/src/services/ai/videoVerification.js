import crypto from "crypto";
import fs from "fs";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import Item from "../../models/Item.js";
import { findMockItemByVideoSignature, updateMockItem } from "../mockItemStore.js";
import { isMockAuthEnabled } from "../mockAuthStore.js";

// 🔴 FORCE DISABLE (MASTER SWITCH)
const FORCE_DISABLE_AI_VIDEO = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_SCRIPT_PATH = path.join(__dirname, "scripts", "video_verification.py");

const OPEN_CV_ENABLED = `${process.env.AI_VIDEO_OPENCV_ENABLED ?? "true"}`.toLowerCase() !== "false";
const PYTHON_BIN = process.env.AI_VIDEO_PYTHON_BIN || "python";
const ANALYSIS_TIMEOUT_MS = Number(process.env.AI_VIDEO_ANALYSIS_TIMEOUT_MS || 20000);
const AI_TIMEOUT_MS = Number(process.env.AI_VIDEO_AI_TIMEOUT_MS || 12000);

const UNIQUE_RATIO_MIN = Number(process.env.AI_VIDEO_UNIQUE_RATIO_MIN || 0.45);
const DURATION_MIN_SECONDS = Number(process.env.AI_VIDEO_MIN_DURATION_SECONDS || 2);
const SUSPICIOUS_SCORE_THRESHOLD = Number(process.env.AI_VIDEO_SUSPICIOUS_SCORE_THRESHOLD || 60);
const REQUIRE_LIVENESS_PROMPT =
  `${process.env.AI_VIDEO_REQUIRE_LIVENESS_PROMPT || "false"}`.toLowerCase() === "true";
const BLOCK_ON_DUPLICATE =
  `${process.env.AI_VIDEO_BLOCK_ON_DUPLICATE || "true"}`.toLowerCase() === "true";
const VIDEO_VALIDATION_ENABLED =
  `${process.env.AI_VIDEO_VALIDATION_ENABLED || "true"}`.toLowerCase() === "true";
const AI_MATCH_ENABLED = `${process.env.AI_VIDEO_AI_MATCH_ENABLED || "true"}`.toLowerCase() === "true";
const AI_BLOCK_IF_UNAVAILABLE =
  `${process.env.AI_VIDEO_BLOCK_IF_AI_UNAVAILABLE || "true"}`.toLowerCase() === "true";
const AI_STRICT_MATCH_MODE =
  `${process.env.AI_VIDEO_STRICT_MATCH_MODE || "true"}`.toLowerCase() === "true";
const AI_PROVIDER = `${process.env.AI_VIDEO_PROVIDER || "auto"}`.toLowerCase();
const AI_MATCH_MIN_CONFIDENCE = Number(process.env.AI_VIDEO_MATCH_MIN_CONFIDENCE || 0.55);
const AI_SEMANTIC_MIN_SIMILARITY = Number(process.env.AI_VIDEO_SEMANTIC_MIN_SIMILARITY || 0.72);
const SAMPLE_FRAME_LIMIT = Number(process.env.AI_VIDEO_SAMPLE_FRAME_LIMIT || 6);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.AI_VIDEO_GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL =
  process.env.AI_VIDEO_GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.AI_VIDEO_OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_EMBEDDING_MODEL =
  process.env.AI_VIDEO_OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ============================
   🔴 BYPASSED FUNCTIONS BELOW
============================ */

// ✅ PRECHECK — ALWAYS PASS
export const precheckItemVideoForUpload = async () => {
  if (FORCE_DISABLE_AI_VIDEO) {
    return {
      ok: true,
      skipped: true,
      reason: "AI video verification bypassed (forced).",
    };
  }
};

// ✅ BACKGROUND VERIFICATION — DISABLED
export const verifyItemVideoInBackground = () => {
  if (FORCE_DISABLE_AI_VIDEO) {
    return;
  }
};