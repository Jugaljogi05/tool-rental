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

const extractJsonObject = (text = "") => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

const extractGeminiText = (data = {}) => {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => `${part?.text || ""}`.trim()).filter(Boolean).join("\n").trim();
};

const buildFallbackAnswer = ({ itemTitle, itemDescription, category, userQuestion }) => {
  const title = `${itemTitle || "this item"}`.trim();
  const cat = `${category || ""}`.trim().toLowerCase();
  const question = `${userQuestion || ""}`.trim().toLowerCase();

  const generalSteps = [
    `1. Inspect ${title} before starting.`,
    "2. Put on any needed safety gear.",
    "3. Read the manual or labels first.",
    "4. Start on the lowest safe setting.",
    "5. Stop immediately if something feels unsafe.",
  ];

  const safetyNotes = [
    "Keep hands clear of moving parts.",
    "Unplug or power off before adjusting attachments.",
    "Work in a clear, dry area.",
  ];

  if (/\b(drill|power drill|cordless drill)\b/.test(`${title} ${itemDescription}`.toLowerCase())) {
    return [
      `You can use ${title} for drilling holes in wood, metal, or drywall.`,
      "1. Fit the correct drill bit tightly.",
      "2. Mark the spot and hold the drill straight.",
      "3. Start slowly, then increase speed gently.",
      "Safety: wear eye protection and keep fingers away from the bit.",
      "If you're unsure about the material, check the manual or ask a professional.",
    ].join(" ");
  }

  if (/\bladder\b/.test(`${title} ${itemDescription}`.toLowerCase())) {
    return [
      `Use ${title} on flat, stable ground only.`,
      "1. Open it fully and lock the spreader.",
      "2. Test stability before climbing.",
      "3. Keep your body centered and three points of contact.",
      "Safety: never stand on the top rung.",
      "If the ladder feels unstable, stop and check the manual or professional help.",
    ].join(" ");
  }

  if (question.includes("how") || question.includes("use") || question.includes("operate")) {
    return [
      `Here is a simple way to use ${title}:`,
      ...generalSteps,
      `Safety tips: ${safetyNotes.join(" ")}`,
      "If you're unsure, check the manual or professional help.",
    ].join(" ");
  }

  return `I can give basic guidance for ${title}, but for exact steps and safety limits, check the manual or professional help.`;
};

export const generateToolChatAnswer = async ({ itemTitle, itemDescription, category, userQuestion }) => {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return {
      ok: true,
      answer: buildFallbackAnswer({ itemTitle, itemDescription, category, userQuestion }),
      source: "fallback",
    };
  }

  const prompt = [
    "You are an assistant that explains how to use tools safely.",
    "Given an item, explain:",
    "- what it is used for",
    "- step-by-step usage",
    "- safety tips",
    "Keep it simple for beginners.",
    "Avoid technical jargon unless necessary.",
    "If unsure, say: Check manual or professional help.",
    "Do NOT give harmful instructions.",
    `Item title: ${itemTitle || ""}`,
    `Item description: ${itemDescription || ""}`,
    `Category: ${category || ""}`,
    `User question: ${userQuestion || ""}`,
    'Return ONLY valid JSON in this exact shape: {"answer":"text response"}',
  ].join("\n");

  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": geminiKey },
    getTimeoutMs(),
    "Tool chat timed out."
  );

  if (!response.ok) {
    return {
      ok: true,
      answer: buildFallbackAnswer({ itemTitle, itemDescription, category, userQuestion }),
      source: "fallback",
      reason: response.reason,
    };
  }

  const rawText = extractGeminiText(response.data);
  const parsed = extractJsonObject(rawText);
  const answer = `${parsed?.answer || ""}`.trim();
  if (!answer) {
    return {
      ok: true,
      answer: buildFallbackAnswer({ itemTitle, itemDescription, category, userQuestion }),
      source: "fallback",
      reason: "AI response was invalid.",
    };
  }

  return {
    ok: true,
    answer,
    source: "ai",
  };
};
