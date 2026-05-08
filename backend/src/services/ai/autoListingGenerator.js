import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { extractGeminiText, extractJsonObject } from "./responseParsing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIDEO_SCRIPT_PATH = path.join(__dirname, "scripts", "video_verification.py");

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || "";
const getGeminiModel = () => process.env.AI_AUTO_LISTING_GEMINI_MODEL || "gemini-2.5-flash";
const getOpenAiApiKey = () => process.env.OPENAI_API_KEY || "";
const getOpenAiModel = () => process.env.AI_AUTO_LISTING_OPENAI_MODEL || "gpt-4.1-mini";
const getAiTimeoutMs = () => Number(process.env.AI_AUTO_LISTING_TIMEOUT_MS || 20000);
const getMaxMediaItems = () => Number(process.env.AI_AUTO_LISTING_MAX_MEDIA_ITEMS || 5);
const getMaxVideoFrames = () => Number(process.env.AI_AUTO_LISTING_MAX_VIDEO_FRAMES || 4);
const ALLOWED_CATEGORIES = ["Tools", "Kitchen", "Furniture", "Electronics"];
const ALLOWED_CONDITIONS = ["new", "good", "used", "damaged"];

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

const postJson = async (url, payload, headers, timeoutMs, timeoutMessage) => {
  if (typeof fetch !== "function") {
    return { ok: false, reason: "Node runtime does not provide fetch. Use Node 18+." };
  }

  let response;
  try {
    response = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      }),
      timeoutMs,
      timeoutMessage
    );
  } catch (error) {
    return { ok: false, reason: error.message };
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      ok: false,
      reason: `AI request failed (${response.status}): ${errorText.slice(0, 180) || "Unknown error"}`,
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, reason: `Invalid AI JSON response: ${error.message}` };
  }
};

const extractText = (data = {}, provider = "gemini") => {
  if (provider === "gemini") {
    return extractGeminiText(data);
  }

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  if (!Array.isArray(data.output)) return "";

  data.output.forEach((block) => {
    if (typeof block?.text === "string" && block.text.trim()) {
      chunks.push(block.text.trim());
    }
    if (!Array.isArray(block?.content)) return;
    block.content.forEach((part) => {
      const text = part?.text || part?.output_text || part?.value;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    });
  });

  return chunks.join("\n").trim();
};

const parseDataUrl = (value) => {
  const match = `${value || ""}`.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const dataUrlToBuffer = (value) => {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;
  return {
    buffer: Buffer.from(parsed.base64, "base64"),
    mimeType: parsed.mimeType,
  };
};

const isRemoteUrl = (value) => /^https?:\/\//i.test(`${value || ""}`);

const fetchAsBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get("content-type") || "application/octet-stream",
  };
};

const bufferToInlineData = (buffer, mimeType = "application/octet-stream") => ({
  inline_data: {
    mime_type: mimeType,
    data: buffer.toString("base64"),
  },
});

const normalizeCategory = (value) => {
  const text = `${value || ""}`.toLowerCase();
  if (ALLOWED_CATEGORIES.some((category) => category.toLowerCase() === text)) {
    return ALLOWED_CATEGORIES.find((category) => category.toLowerCase() === text) || "";
  }
  if (/\b(kitchen|blender|mixer|cook|pan|pot|utensil)\b/.test(text)) return "Kitchen";
  if (/\b(furniture|chair|table|sofa|bed|desk)\b/.test(text)) return "Furniture";
  if (/\b(electronic|electronics|laptop|camera|phone|speaker|tv|charger)\b/.test(text)) {
    return "Electronics";
  }
  if (/\b(tool|tools|drill|hammer|saw|wrench|ladder)\b/.test(text)) return "Tools";
  return "";
};

const normalizeCondition = (value) => {
  const text = `${value || ""}`.toLowerCase().trim();
  return ALLOWED_CONDITIONS.includes(text) ? text : "";
};

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => `${tag || ""}`.trim())
    .filter(Boolean)
    .slice(0, 8);
};

const normalizeSuggestedPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
};

const runCommand = (bin, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
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
        return reject(new Error(`Command timed out: ${bin}`));
      }
      if (code !== 0) {
        return reject(new Error(stderr || `Command failed with code ${code}`));
      }
      return resolve(stdout);
    });
  });

const extractVideoFrames = async (videoInput) => {
  if (!videoInput) return [];

  let tempVideoPath = "";
  try {
    if (typeof videoInput === "string" && isRemoteUrl(videoInput)) {
      const fetched = await fetchAsBuffer(videoInput);
      tempVideoPath = path.join(os.tmpdir(), `borrowly-video-${Date.now()}.mp4`);
      fs.writeFileSync(tempVideoPath, fetched.buffer);
    } else if (typeof videoInput === "string") {
      const parsed = dataUrlToBuffer(videoInput);
      if (!parsed) return [];
      tempVideoPath = path.join(os.tmpdir(), `borrowly-video-${Date.now()}.mp4`);
      fs.writeFileSync(tempVideoPath, parsed.buffer);
    } else {
      return [];
    }

    const raw = await runCommand(process.env.AI_VIDEO_PYTHON_BIN || "python", [VIDEO_SCRIPT_PATH, tempVideoPath, "--include-samples"], 25000);
    const parsed = JSON.parse(raw);
    if (!parsed.ok) return [];
    return Array.isArray(parsed.sampleFrames) ? parsed.sampleFrames.slice(0, getMaxVideoFrames()) : [];
  } catch {
    return [];
  } finally {
    if (tempVideoPath) {
      fs.unlink(tempVideoPath, () => {});
    }
  }
};

const normalizeImageMedia = async (value) => {
  if (!value) return null;
  if (typeof value !== "string") return null;
  if (value.startsWith("data:")) {
    const parsed = dataUrlToBuffer(value);
    return parsed ? bufferToInlineData(parsed.buffer, parsed.mimeType) : null;
  }
  if (isRemoteUrl(value)) {
    const fetched = await fetchAsBuffer(value);
    return bufferToInlineData(fetched.buffer, fetched.mimeType);
  }
  return null;
};

const resolveProvider = () => {
  if (getGeminiApiKey()) return "gemini";
  if (getOpenAiApiKey()) return "openai";
  return null;
};

const buildPrompt = ({ hint, mediaCount }) => [
  "You are an AI that generates marketplace listings.",
  "Analyze the provided item images and/or video frames.",
  "Return a clear, concise title, a helpful description, the correct category, relevant tags, condition, and a realistic suggested rental price.",
  "Be accurate and avoid hallucination.",
  `User hint: ${hint || ""}`,
  `Available categories: ${ALLOWED_CATEGORIES.join(", ")}`,
  `Condition must be one of: ${ALLOWED_CONDITIONS.join(", ")}`,
  `You are analyzing ${mediaCount} media items.`,
  "Return ONLY valid JSON in this exact shape:",
  '{"title":"string","description":"string","category":"string","tags":["string"],"condition":"new|good|used|damaged","suggestedPrice":number}',
].join("\n");

const extractRawGenerated = async ({ images = [], video = null, hint = "" }) => {
  const provider = resolveProvider();
  if (!provider) {
    return { ok: false, reason: "No AI provider configured." };
  }

  const maxImages = images.slice(0, getMaxMediaItems());
  const imageParts = [];
  for (const image of maxImages) {
    const part = await normalizeImageMedia(image);
    if (part) imageParts.push(part);
  }

  const videoFrames = await extractVideoFrames(video);
  const videoParts = videoFrames.map((frame) => bufferToInlineData(Buffer.from(frame, "base64"), "image/jpeg"));

  const parts = [
    { text: buildPrompt({ hint, mediaCount: imageParts.length + videoParts.length }) },
    ...imageParts,
    ...videoParts,
  ];

  if (parts.length === 1) {
    return { ok: false, reason: "No valid images or video frames were provided." };
  }

  if (provider === "gemini") {
    const response = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`,
      {
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      },
      { "x-goog-api-key": getGeminiApiKey() },
      getAiTimeoutMs(),
      "Auto listing generation timed out."
    );

    if (!response.ok) return response;
    const rawText = extractText(response.data, "gemini");
    return { ok: true, rawText };
  }

  const response = await postJson(
    "https://api.openai.com/v1/responses",
    {
      model: getOpenAiModel(),
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt({ hint, mediaCount: imageParts.length + videoParts.length }) },
            ...imageParts.map((part) => ({
              type: "input_image",
              image_url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`,
            })),
            ...videoParts.map((part) => ({
              type: "input_image",
              image_url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`,
            })),
          ],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 400,
    },
    { Authorization: `Bearer ${getOpenAiApiKey()}` },
    getAiTimeoutMs(),
    "Auto listing generation timed out."
  );

  if (!response.ok) return response;
  return { ok: true, rawText: extractText(response.data, "openai") };
};

const emptyListingDetails = () => ({
  title: "",
  description: "",
  category: "",
  tags: [],
  condition: "",
  suggestedPrice: null,
});

export const generateListingDetails = async ({ images = [], video = null, hint = "" }) => {
  const provider = resolveProvider();
  const extracted = await extractRawGenerated({ images, video, hint });
  if (!extracted.ok) {
    return {
      ok: false,
      data: emptyListingDetails(),
      reason:
        extracted.reason || `Unable to generate listing details. Provider seen by backend: ${provider || "none"}.`,
    };
  }

  const parsed = extractJsonObject(extracted.rawText);
  if (!parsed) {
    return {
      ok: false,
      data: emptyListingDetails(),
      reason: "AI response was not valid JSON.",
    };
  }

  const data = {
    title: `${parsed.title || ""}`.trim(),
    description: `${parsed.description || ""}`.trim(),
    category: normalizeCategory(parsed.category),
    tags: normalizeTags(parsed.tags),
    condition: normalizeCondition(parsed.condition),
    suggestedPrice: normalizeSuggestedPrice(parsed.suggestedPrice),
  };

  return {
    ok: true,
    data,
  };
};
