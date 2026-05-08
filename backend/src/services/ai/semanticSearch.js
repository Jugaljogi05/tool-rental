const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_EMBEDDING_MODEL =
  process.env.AI_SEARCH_GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const AI_SEARCH_TIMEOUT_MS = Number(process.env.AI_SEARCH_TIMEOUT_MS || 12000);
const AI_SEARCH_MIN_SIMILARITY = Number(process.env.AI_SEARCH_MIN_SIMILARITY || 0.32);
const AI_SEARCH_MAX_CANDIDATES = Number(process.env.AI_SEARCH_MAX_CANDIDATES || 60);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
      reason: `Gemini request failed (${response.status}): ${errorText.slice(0, 180) || "Unknown error"}`,
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch (error) {
    return { ok: false, reason: `Invalid Gemini JSON response: ${error.message}` };
  }
};

const normalizeVector = (vector = []) => {
  const values = vector.map((value) => Number(value || 0));
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return values;
  return values.map((value) => value / magnitude);
};

const cosineSimilarity = (vectorA = [], vectorB = []) => {
  if (!vectorA.length || !vectorB.length || vectorA.length !== vectorB.length) return 0;

  let dot = 0;
  for (let index = 0; index < vectorA.length; index += 1) {
    dot += Number(vectorA[index] || 0) * Number(vectorB[index] || 0);
  }
  return clamp(dot, -1, 1);
};

const normalizeText = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();

const buildItemSearchText = (item) => {
  const name = normalizeText(item?.name);
  const category = normalizeText(item?.category);
  const description = normalizeText(item?.description);
  return [name, category, description].filter(Boolean).join(". ");
};

const looksLikeNaturalLanguageQuery = (query) => {
  const normalized = normalizeText(query).toLowerCase();
  if (normalized.length < 8) return false;

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 2) return true;

  return /\b(need|want|looking|search|find|rent|borrow|cheap|best|near|around|for)\b/.test(
    normalized
  );
};

const embedText = async (text) => {
  if (!GEMINI_API_KEY) {
    return { ok: false, reason: "GEMINI_API_KEY is missing." };
  }

  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent`,
    {
      content: {
        parts: [{ text }],
      },
      task_type: "SEMANTIC_SIMILARITY",
    },
    { "x-goog-api-key": GEMINI_API_KEY },
    AI_SEARCH_TIMEOUT_MS,
    "Gemini embedding request timed out."
  );

  if (!response.ok) return response;

  const vector = response.data?.embedding?.values || response.data?.embeddings?.[0]?.values;
  if (!Array.isArray(vector) || !vector.length) {
    return { ok: false, reason: "Gemini embedding vector missing." };
  }

  return { ok: true, vector: normalizeVector(vector) };
};

export const shouldUseSemanticSearch = (query) => looksLikeNaturalLanguageQuery(query);

export const rankItemsBySemanticSearch = async ({ query, items = [] }) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { ok: false, reason: "Query is empty." };
  }

  if (!looksLikeNaturalLanguageQuery(normalizedQuery)) {
    return { ok: false, reason: "Query does not look like natural language." };
  }

  if (!GEMINI_API_KEY) {
    return { ok: false, reason: "GEMINI_API_KEY is missing." };
  }

  const candidates = items
    .filter((item) => item && item.isActive !== false && item.availabilityStatus === "Available")
    .slice(0, Math.max(1, AI_SEARCH_MAX_CANDIDATES));

  if (!candidates.length) {
    return { ok: true, items: [] };
  }

  const texts = [normalizedQuery, ...candidates.map((item) => buildItemSearchText(item))];
  const embeddingResults = await Promise.all(texts.map((text) => embedText(text)));
  const failure = embeddingResults.find((result) => !result.ok);
  if (failure) {
    return { ok: false, reason: failure.reason || "Unable to generate embeddings." };
  }

  const [queryVector, ...itemVectors] = embeddingResults.map((result) => result.vector);
  const rankedItems = candidates
    .map((item, index) => {
      const similarity = cosineSimilarity(queryVector, itemVectors[index]);
      const semanticScore = clamp((similarity + 1) / 2, 0, 1);
      return {
        ...item,
        semanticScore: Number(semanticScore.toFixed(4)),
      };
    })
    .sort((left, right) => {
      if (right.semanticScore !== left.semanticScore) {
        return right.semanticScore - left.semanticScore;
      }
      return new Date(right.createdAt) - new Date(left.createdAt);
    });

  const matchedItems = rankedItems.filter(
    (item) => item.semanticScore >= AI_SEARCH_MIN_SIMILARITY
  );

  return {
    ok: true,
    items: matchedItems,
    rankedItems,
  };
};
