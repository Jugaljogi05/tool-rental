import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import Item from "../../models/Item.js";
import { isMockAuthEnabled } from "../mockAuthStore.js";
import { getMockItemById, listMockRecommendationCandidates } from "../mockItemStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_SCRIPT_PATH = path.join(__dirname, "scripts", "recommendation_model.py");
const getPythonCandidates = () => {
  const candidates = [
    process.env.AI_RECOMMENDATION_PYTHON_BIN,
    process.env.AI_VIDEO_PYTHON_BIN,
    process.env.PYTHON_BIN,
    "C:\\Users\\Jugal\\AppData\\Local\\Python\\bin\\python.exe",
    "C:\\Users\\Jugal\\AppData\\Local\\Programs\\Python\\Launcher\\py.exe",
    "python",
    "python3",
    "py",
  ];

  return candidates.filter(Boolean).filter((candidate) => {
    if (candidate.includes("\\") || candidate.includes("/")) {
      return fs.existsSync(candidate);
    }
    return true;
  });
};
const getTimeoutMs = () => Number(process.env.AI_RECOMMENDATIONS_TIMEOUT_MS || 12000);
const MAX_RECOMMENDATIONS = 5;

const withTimeout = async (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const runPythonOnce = (bin, args, input, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        return reject(new Error(`Recommendation model timed out after ${timeoutMs}ms.`));
      }
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `Recommendation model exited with code ${code}.`));
      }
      return resolve(stdout);
    });

    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });

const runPython = async (args, input, timeoutMs) => {
  const candidates = getPythonCandidates();
  let lastError = null;

  for (const bin of candidates) {
    try {
      return await runPythonOnce(bin, args, input, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No Python interpreter found for the recommendation model.");
};

const normalizeText = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();

const loadSeedItem = async ({ itemId, itemTitle, category, description }) => {
  const fallbackSeed = {
    _id: itemId || "",
    name: itemTitle || "",
    category: category || "",
    description: description || "",
    pricePerDay: null,
  };

  if (!itemId) {
    return fallbackSeed;
  }

  if (isMockAuthEnabled()) {
    const mockItem = getMockItemById(itemId);
    if (mockItem) return mockItem;
    return fallbackSeed;
  }

  try {
    const item = await Item.findById(itemId)
      .select("name category description pricePerDay createdAt availabilityStatus isActive")
      .lean();
    return item || fallbackSeed;
  } catch {
    return fallbackSeed;
  }
};

const loadCatalogItems = async ({ excludeItemId }) => {
  if (isMockAuthEnabled()) {
    return listMockRecommendationCandidates({ excludeItemId });
  }

  const filter = {
    isActive: true,
    availabilityStatus: "Available",
  };

  if (excludeItemId) {
    filter._id = { $ne: excludeItemId };
  }

  return Item.find(filter)
    .select("name category description pricePerDay createdAt availabilityStatus isActive")
    .sort({ createdAt: -1 })
    .lean();
};

const buildPayload = ({ seedItem, candidates, maxRecommendations = MAX_RECOMMENDATIONS }) => ({
  seedItem: {
    _id: `${seedItem._id || ""}`,
    name: normalizeText(seedItem.name),
    category: normalizeText(seedItem.category),
    description: normalizeText(seedItem.description),
    pricePerDay: Number(seedItem.pricePerDay || 0) || null,
  },
  candidates: candidates.map((candidate) => ({
    _id: `${candidate._id || ""}`,
    name: normalizeText(candidate.name),
    category: normalizeText(candidate.category),
    description: normalizeText(candidate.description),
    pricePerDay: Number(candidate.pricePerDay || 0) || null,
    createdAt: candidate.createdAt || null,
  })),
  maxRecommendations,
});

const parsePythonOutput = (raw) => {
  const trimmed = `${raw || ""}`.trim();
  if (!trimmed) {
    throw new Error("Recommendation model returned an empty response.");
  }
  const parsed = JSON.parse(trimmed);
  if (parsed?.error) {
    throw new Error(parsed.error);
  }
  return parsed;
};

export const generateRecommendations = async ({ itemId = "", itemTitle = "", category = "", description = "" }) => {
  try {
    const seedItem = await loadSeedItem({
      itemId,
      itemTitle,
      category,
      description,
    });

    const catalogItems = await loadCatalogItems({ excludeItemId: itemId });
    if (!catalogItems.length) {
      return { ok: true, recommendations: [], source: "local-ml" };
    }

    const payload = buildPayload({
      seedItem,
      candidates: catalogItems,
      maxRecommendations: MAX_RECOMMENDATIONS,
    });

    let output = "";
    try {
      output = await withTimeout(
        runPython([MODEL_SCRIPT_PATH], `${JSON.stringify(payload)}\n`, getTimeoutMs()),
        getTimeoutMs() + 500,
        "Recommendation model timed out."
      );
    } catch (error) {
      return {
        ok: false,
        reason: `Local recommendation model failed: ${error.message}`,
      };
    }

    const parsed = parsePythonOutput(output);
    const recommendations = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
          .map((item) => ({
            name: `${item?.name || ""}`.trim(),
            reason: `${item?.reason || ""}`.trim(),
          }))
          .filter((item) => item.name)
          .slice(0, MAX_RECOMMENDATIONS)
      : [];

    return {
      ok: true,
      recommendations,
      source: "local-python-ml",
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Local recommendation model failed: ${error.message}`,
    };
  }
};
