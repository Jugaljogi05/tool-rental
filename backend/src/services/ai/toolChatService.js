import { extractGeminiText, extractJsonObject, extractLooseString, getGeminiFinishReason } from "./responseParsing.js";

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || "";
const getGeminiModel = () => process.env.AI_TOOL_CHAT_GEMINI_MODEL || "gemini-2.5-flash";
const getTimeoutMs = () => Number(process.env.AI_TOOL_CHAT_TIMEOUT_MS || 12000);

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
    let exactReason = errorText.slice(0, 300) || "Unknown error";

    try {
      const parsedError = JSON.parse(errorText);
      exactReason =
        parsedError?.error?.message ||
        parsedError?.message ||
        parsedError?.error?.status ||
        exactReason;
      if (parsedError?.error?.code) {
        exactReason = `HTTP ${parsedError.error.code}: ${exactReason}`;
      }
    } catch {
      // Keep the raw truncated body when Gemini does not send JSON.
    }

    return {
      ok: false,
      reason: `AI request failed (${response.status}): ${exactReason}`,
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, reason: `Invalid AI JSON response: ${error.message}` };
  }
};

const buildPrompt = ({ itemTitle, itemDescription, category, userQuestion }) => [
  "You are an expert assistant that explains how to use rental items safely and practically.",
  "Answer the user's question using the specific item details below.",
  "The answer must be tailored to the item, not generic or copied from a fixed template.",
  "Explain what the item is used for, how to operate it, and any important safety tips.",
  "If the question is unclear, ask for clarification inside the answer.",
  "If there are unknowns, say to check the manual or a professional.",
  "Avoid harmful or unsafe instructions.",
  "Return only valid JSON with this exact shape: {\"answer\":\"text response\"}",
  `Item title: ${itemTitle || ""}`,
  `Item description: ${itemDescription || ""}`,
  `Category: ${category || ""}`,
  `User question: ${userQuestion || ""}`,
].join("\n");

const buildContinuationPrompt = ({ rawText }) => [
  "Continue the previous Gemini response from where it stopped.",
  "Do not repeat the opening brace or any already written text.",
  "Return only the missing remainder needed to complete the same JSON object.",
  `Partial response so far: ${rawText || ""}`,
].join("\n");

const isLikelyTruncated = (data = {}, rawText = "") => {
  const finishReason = getGeminiFinishReason(data).toUpperCase();
  if (finishReason === "MAX_TOKENS" || finishReason === "LENGTH") return true;
  const trimmed = `${rawText || ""}`.trim();
  return trimmed === "{" || trimmed === "[" || trimmed.endsWith(':"') || trimmed.endsWith('":');
};

const requestContinuation = async ({ geminiKey, rawText }) => {
  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildContinuationPrompt({ rawText }) }],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": geminiKey },
    getTimeoutMs(),
    "Tool chat continuation timed out."
  );

  if (!response.ok) {
    return "";
  }

  return extractGeminiText(response.data);
};

export const generateToolChatAnswer = async ({ itemTitle, itemDescription, category, userQuestion }) => {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return {
      ok: false,
      reason: "GEMINI_API_KEY is not set for tool guidance.",
    };
  }

  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt({ itemTitle, itemDescription, category, userQuestion }) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": geminiKey },
    getTimeoutMs(),
    "Tool chat timed out."
  );

  if (!response.ok) {
    return {
      ok: false,
      reason: response.reason,
    };
  }

  const rawText = extractGeminiText(response.data);
  const parsed = extractJsonObject(rawText);
  const trimmedRawText = `${rawText || ""}`.trim();
  const answer =
    `${parsed?.answer || ""}`.trim() ||
    `${extractLooseString(rawText, "answer") || ""}`.trim() ||
    (trimmedRawText && !trimmedRawText.startsWith("{") && !trimmedRawText.startsWith("[") ? trimmedRawText : "");

  if (!answer && isLikelyTruncated(response.data, rawText)) {
    const continuationText = await requestContinuation({ geminiKey, rawText });
    const combinedText = `${rawText || ""}${continuationText || ""}`.trim();
    const continuedParsed = extractJsonObject(combinedText);
    const trimmedCombinedText = `${combinedText || ""}`.trim();
    const continuedAnswer =
      `${continuedParsed?.answer || ""}`.trim() ||
      `${extractLooseString(combinedText, "answer") || ""}`.trim() ||
      (trimmedCombinedText && !trimmedCombinedText.startsWith("{") && !trimmedCombinedText.startsWith("[")
        ? trimmedCombinedText
        : "");

    if (continuedAnswer) {
      return {
        ok: true,
        answer: continuedAnswer,
        source: "ai",
      };
    }
  }

  if (!answer) {
    return {
      ok: false,
      reason: `Gemini returned no usable answer. Raw response: ${rawText.slice(0, 300) || "empty response"}`,
    };
  }

  return {
    ok: true,
    answer,
    source: "ai",
  };
};
