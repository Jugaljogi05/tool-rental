const getGeminiApiKey = () => process.env.GEMINI_API_KEY || "";
const getGeminiModel = () => process.env.AI_RECOMMENDATIONS_GEMINI_MODEL || "gemini-2.5-flash";
const getTimeoutMs = () => Number(process.env.AI_RECOMMENDATIONS_TIMEOUT_MS || 12000);

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

const normalizeText = (value) => `${value || ""}`.trim().toLowerCase();

const uniqueRecommendations = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeText(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fallbackMap = [
  {
    pattern: /\bdrill|drilling\b/,
    items: [
      { name: "Drill bits", reason: "Useful for different hole sizes and materials." },
      { name: "Safety goggles", reason: "Protects your eyes while drilling." },
      { name: "Work gloves", reason: "Improves grip and hand safety." },
      { name: "Extension cord", reason: "Helps when the work area is far from power." },
    ],
  },
  {
    pattern: /\bladder\b/,
    items: [
      { name: "Work gloves", reason: "Helps with grip while climbing." },
      { name: "Safety goggles", reason: "Protects eyes from dust and debris." },
      { name: "Paint roller", reason: "Common companion for ladder-based painting jobs." },
      { name: "Bucket hook", reason: "Handy for carrying paint or tools safely." },
    ],
  },
  {
    pattern: /\bmixer\b/,
    items: [
      { name: "Mixing bowls", reason: "Useful for preparing ingredients." },
      { name: "Measuring cups", reason: "Helps with accurate portions." },
      { name: "Spatula set", reason: "Makes mixing and scraping easier." },
    ],
  },
  {
    pattern: /\bcamera\b/,
    items: [
      { name: "Tripod", reason: "Helps keep the camera steady." },
      { name: "Memory card", reason: "Useful for longer recording sessions." },
      { name: "Spare battery", reason: "Great for extended shoots." },
    ],
  },
  {
    pattern: /\bpaint|painting\b/,
    items: [
      { name: "Paint roller", reason: "Useful for larger wall surfaces." },
      { name: "Painter's tape", reason: "Helps with clean edges." },
      { name: "Drop cloth", reason: "Protects floors and furniture." },
    ],
  },
];

const categoryFallback = {
  Tools: [
    { name: "Work gloves", reason: "Good general protection for tool work." },
    { name: "Safety goggles", reason: "Protects your eyes during DIY tasks." },
    { name: "Extension cord", reason: "Helpful for powered tools." },
  ],
  Kitchen: [
    { name: "Measuring cups", reason: "Useful for precise prep and mixing." },
    { name: "Mixing bowls", reason: "Handy for prep work." },
    { name: "Spatula set", reason: "Useful for cooking and serving." },
  ],
  Furniture: [
    { name: "Moving blankets", reason: "Helps protect furniture during transport." },
    { name: "Furniture straps", reason: "Makes moving heavier items easier." },
    { name: "Furniture dolly", reason: "Useful for transport and setup." },
  ],
  Electronics: [
    { name: "Spare battery", reason: "Useful for longer use sessions." },
    { name: "Memory card", reason: "Helpful for storage and recording." },
    { name: "Cable organizer", reason: "Keeps setup tidy." },
  ],
};

const buildFallbackRecommendations = ({ itemTitle, category, description }) => {
  const titleText = normalizeText(itemTitle);
  const categoryText = `${category || ""}`.trim();
  const descriptionText = normalizeText(description);
  const basis = `${titleText} ${descriptionText}`;

  const matches = [];
  fallbackMap.forEach((entry) => {
    if (entry.pattern.test(basis)) {
      matches.push(...entry.items);
    }
  });

  if (!matches.length && categoryFallback[categoryText]) {
    matches.push(...categoryFallback[categoryText]);
  }

  if (!matches.length) {
    matches.push(
      { name: "Safety gloves", reason: "Useful for general handling and protection." },
      { name: "Work light", reason: "Helps when working in dim areas." },
      { name: "Measuring tape", reason: "Useful for setup and planning." }
    );
  }

  return uniqueRecommendations(matches).slice(0, 5);
};

export const generateRecommendations = async ({ itemTitle, category, description }) => {
  const fallbackRecommendations = buildFallbackRecommendations({
    itemTitle,
    category,
    description,
  });

  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    return {
      ok: true,
      recommendations: fallbackRecommendations,
      source: "fallback",
    };
  }

  const prompt = [
    "Suggest 3 to 5 related or complementary rental items for this item.",
    "Be concise and practical.",
    "Return only valid JSON with shape: {\"recommendations\":[{\"name\":\"string\",\"reason\":\"string\"}]}",
    `Item title: ${itemTitle || ""}`,
    `Category: ${category || ""}`,
    `Description: ${description || ""}`,
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
        temperature: 0.3,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": geminiKey },
    getTimeoutMs(),
    "Recommendation generation timed out."
  );

  if (!response.ok) {
    return {
      ok: true,
      recommendations: fallbackRecommendations,
      source: "fallback",
      reason: response.reason,
    };
  }

  const rawText = extractGeminiText(response.data);
  const parsed = extractJsonObject(rawText);
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations
        .map((item) => ({
          name: `${item?.name || ""}`.trim(),
          reason: `${item?.reason || ""}`.trim(),
        }))
        .filter((item) => item.name)
    : [];

  return {
    ok: true,
    recommendations: recommendations.length ? uniqueRecommendations(recommendations).slice(0, 5) : fallbackRecommendations,
    source: recommendations.length ? "ai" : "fallback",
  };
};
