import { extractGeminiText, extractJsonObject, extractLooseString } from "./responseParsing.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.AI_SEARCH_GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL = process.env.AI_SEARCH_GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
const AI_SEARCH_TIMEOUT_MS = Number(process.env.AI_SEARCH_TIMEOUT_MS || 12000);
const AI_SEARCH_EMBEDDING_TIMEOUT_MS = Number(
  process.env.AI_SEARCH_EMBEDDING_TIMEOUT_MS || AI_SEARCH_TIMEOUT_MS
);
const AI_SEARCH_MIN_SIMILARITY = Number(process.env.AI_SEARCH_MIN_SIMILARITY || 0.32);
const AI_SEARCH_MAX_CANDIDATES = Number(process.env.AI_SEARCH_MAX_CANDIDATES || 60);
const AI_SEARCH_QUERY_REWRITE_TIMEOUT_MS = Number(
  process.env.AI_SEARCH_QUERY_REWRITE_TIMEOUT_MS || AI_SEARCH_TIMEOUT_MS
);
const AI_SEARCH_GEMINI_CANDIDATE_LIMIT = Number(
  process.env.AI_SEARCH_GEMINI_CANDIDATE_LIMIT || 24
);
const AI_SEARCH_GEMINI_MAX_RESULTS = Number(process.env.AI_SEARCH_GEMINI_MAX_RESULTS || 12);

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

const normalizeText = (value) => `${value || ""}`.replace(/\s+/g, " ").trim();

const tokenize = (value) =>
  normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean);

const normalizeToken = (token) => {
  const text = `${token || ""}`.toLowerCase().trim();
  if (text.length <= 3) return text;
  if (text.endsWith("ies")) return `${text.slice(0, -3)}y`;
  if (text.endsWith("ing") && text.length > 5) return text.slice(0, -3);
  if (text.endsWith("ers") && text.length > 5) return text.slice(0, -1);
  if (text.endsWith("er") && text.length > 4) return text.slice(0, -2);
  if (text.endsWith("ed") && text.length > 4) return text.slice(0, -2);
  if (text.endsWith("es") && text.length > 4) return text.slice(0, -2);
  if (text.endsWith("s") && text.length > 4) return text.slice(0, -1);
  return text;
};

const buildCharNgrams = (value, minN = 3, maxN = 5) => {
  const normalized = ` ${normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const grams = [];

  for (let size = minN; size <= maxN; size += 1) {
    if (normalized.length < size) continue;
    for (let index = 0; index <= normalized.length - size; index += 1) {
      const gram = normalized.slice(index, index + size).trim();
      if (gram && !gram.includes("  ")) {
        grams.push(gram);
      }
    }
  }

  return grams;
};

const cosineSimilarityMap = (left = new Map(), right = new Map()) => {
  if (!(left instanceof Map) || !(right instanceof Map) || !left.size || !right.size) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  left.forEach((leftValue, key) => {
    const rightValue = Number(right.get(key) || 0);
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
  });

  right.forEach((rightValue) => {
    rightNorm += rightValue * rightValue;
  });

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const buildFrequencyMap = (values = []) => {
  const map = new Map();
  values.forEach((value) => {
    const key = `${value || ""}`.trim();
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const SEMANTIC_CAPABILITY_GROUPS = [
  {
    id: "food_processing",
    queryTerms: [
      "grind",
      "blend",
      "mix",
      "mash",
      "crush",
      "puree",
      "mince",
      "chop",
      "process",
      "vegetable",
      "vegetables",
      "paste",
      "masala",
      "smoothie",
      "chutney",
    ],
    itemTerms: [
      "mixer",
      "mixer grinder",
      "mixie",
      "blender",
      "grinder",
      "food processor",
      "juicer",
      "processor",
      "chopper",
    ],
  },
  {
    id: "fastening",
    queryTerms: ["tighten", "tightening", "fasten", "fastening", "screw", "screws", "bolt", "bolts", "nut", "nuts"],
    itemTerms: ["screwdriver", "wrench", "spanner", "driver", "ratchet", "socket", "allen key", "hex key"],
  },
  {
    id: "cutting",
    queryTerms: ["cut", "cutting", "slice", "slicing", "chop", "chopping", "trim", "trimming", "shear"],
    itemTerms: ["knife", "cutter", "cutting", "chopper", "scissor", "scissors", "saw"],
  },
  {
    id: "drilling",
    queryTerms: ["drill", "drilling", "bore", "boring", "hole", "holes"],
    itemTerms: ["drill", "driller", "driver", "drill bit", "hammer drill", "rotary hammer"],
  },
  {
    id: "serving",
    queryTerms: ["serve", "serving", "dish", "dishes", "plate", "plates", "table", "tableware", "eat", "eating"],
    itemTerms: ["plate", "platter", "dish", "bowl", "tray", "serving set", "tableware"],
  },
  {
    id: "cooking",
    queryTerms: ["cook", "cooking", "bake", "baking", "boil", "boiling", "fry", "frying", "heat", "heating"],
    itemTerms: ["stove", "oven", "pan", "pot", "cookware", "grill", "microwave", "pressure cooker"],
  },
];

const escapeRegex = (value) => `${value || ""}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsPhrase = (text, phrase) => {
  if (!text || !phrase) return false;
  const pattern = phrase
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegex)
    .join("\\s+");
  if (!pattern) return false;
  return new RegExp(`\\b${pattern}\\b`, "i").test(text);
};

const extractCapabilityTags = (text) => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return new Set();

  const tags = new Set();
  SEMANTIC_CAPABILITY_GROUPS.forEach((group) => {
    const hasQueryTerm = group.queryTerms.some((term) => containsPhrase(normalized, term));
    if (hasQueryTerm) {
      tags.add(group.id);
    }
  });

  return tags;
};

const extractItemCapabilityTags = (item) => {
  const text = buildItemSearchText(item);
  const normalized = text.toLowerCase();
  const tags = extractCapabilityTags(normalized);

  SEMANTIC_CAPABILITY_GROUPS.forEach((group) => {
    const hasItemTerm = group.itemTerms.some((term) => containsPhrase(normalized, term));
    if (hasItemTerm) {
      tags.add(group.id);
    }
  });

  if (containsPhrase(normalized, "kitchen")) {
    tags.add("kitchen");
  }
  if (containsPhrase(normalized, "tools")) {
    tags.add("tools");
  }

  return tags;
};

const scoreTagOverlap = (queryTags, itemTags) => {
  if (!queryTags.size || !itemTags.size) return 0;

  let matches = 0;
  queryTags.forEach((tag) => {
    if (itemTags.has(tag)) matches += 1;
  });

  return clamp(matches / queryTags.size, 0, 1);
};

const buildEmbeddingText = (parts, maxLength = 1800) =>
  normalizeText(parts.filter(Boolean).join(". ")).slice(0, maxLength);

const buildQueryEmbeddingText = ({ query, queryPlan }) =>
  buildEmbeddingText(
    [
      query,
      queryPlan.searchText,
      queryPlan.intent,
      queryPlan.categoryHint,
      ...(Array.isArray(queryPlan.keywords) ? queryPlan.keywords : []),
    ],
    1200
  );

const buildItemEmbeddingText = (item) =>
  buildEmbeddingText([item?.name, item?.category, item?.description], 1800);

const isEmbeddingModelV2 = GEMINI_EMBEDDING_MODEL.includes("gemini-embedding-2");

const buildEmbeddingRequest = ({ text, taskType, title }) => {
  const request = {
    model: `models/${GEMINI_EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
  };

  if (!isEmbeddingModelV2 && taskType) {
    request.taskType = taskType;
  }

  if (!isEmbeddingModelV2 && title) {
    request.title = title;
  }

  return request;
};

const getEmbeddingVector = (embedding) => {
  if (!embedding || !Array.isArray(embedding.values)) return [];
  return embedding.values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
};

const cosineSimilarity = (left = [], right = []) => {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || !right.length) {
    return 0;
  }

  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number(left[index]) || 0;
    const rightValue = Number(right[index]) || 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const scoreEmbeddingSimilarity = (similarity) => clamp(Number(similarity) || 0, 0, 1);

const buildSemanticReason = ({ queryPlan, item, embeddingScore }) => {
  const itemText = buildItemEmbeddingText(item).toLowerCase();
  const queryText = buildQueryEmbeddingText({ query: queryPlan.searchText || "", queryPlan }).toLowerCase();
  const queryTokens = tokenize(queryText);
  const itemTokens = new Set(tokenize(itemText));
  const sharedTokens = queryTokens.filter((token) => itemTokens.has(token)).slice(0, 3);
  const queryTags = extractCapabilityTags(queryText);
  const itemTags = extractItemCapabilityTags(item);
  const sharedTags = [...queryTags].filter((tag) => itemTags.has(tag)).slice(0, 2);

  if (sharedTags.length) {
    return `Matched capability: ${sharedTags.join(", ")}.`;
  }

  if (sharedTokens.length) {
    return `Matched on ${sharedTokens.join(", ")}.`;
  }

  if (queryPlan.categoryHint && itemText.includes(queryPlan.categoryHint.toLowerCase())) {
    return "Category and item details align with the search intent.";
  }

  if (embeddingScore >= 0.65) {
    return "Strong semantic match between the query intent and item details.";
  }

  if (embeddingScore > 0) {
    return "Semantic similarity detected between the query intent and item details.";
  }

  return "Closest catalog match based on item context.";
};

const scoreTokenSimilarity = (searchTokens = [], itemTokens = []) => {
  if (!searchTokens.length || !itemTokens.length) return 0;

  const itemSet = new Set(itemTokens.map(normalizeToken).filter(Boolean));
  const searchSet = new Set(searchTokens.map(normalizeToken).filter(Boolean));
  if (!itemSet.size || !searchSet.size) return 0;

  let exactHits = 0;
  let prefixHits = 0;
  let partialHits = 0;

  searchSet.forEach((token) => {
    if (itemSet.has(token)) {
      exactHits += 1;
      return;
    }

    for (const itemToken of itemSet) {
      if (itemToken === token) continue;
      if (itemToken.startsWith(token) || token.startsWith(itemToken)) {
        prefixHits += 1;
        return;
      }
      if (itemToken.includes(token) || token.includes(itemToken)) {
        partialHits += 1;
        return;
      }
    }
  });

  const exactScore = exactHits / searchSet.size;
  const prefixScore = prefixHits / searchSet.size;
  const partialScore = partialHits / searchSet.size;
  return clamp(exactScore * 0.75 + prefixScore * 0.18 + partialScore * 0.12, 0, 1);
};

const scoreCharacterSimilarity = (searchText, itemText) => {
  const searchNgrams = buildFrequencyMap(buildCharNgrams(searchText));
  const itemNgrams = buildFrequencyMap(buildCharNgrams(itemText));
  return clamp(cosineSimilarityMap(searchNgrams, itemNgrams), 0, 1);
};

const scoreCapabilitySimilarity = ({ queryPlan, item }) => {
  const queryText = buildQueryEmbeddingText({ query: queryPlan.searchText || "", queryPlan });
  const queryTags = extractCapabilityTags(queryText);
  const itemTags = extractItemCapabilityTags(item);
  const tagScore = scoreTagOverlap(queryTags, itemTags);
  const queryTextLower = queryText.toLowerCase();
  const itemTextLower = buildItemSearchText(item).toLowerCase();

  let lexicalBoost = 0;
  SEMANTIC_CAPABILITY_GROUPS.forEach((group) => {
    const queryHit = group.queryTerms.some((term) => containsPhrase(queryTextLower, term));
    const itemHit = group.itemTerms.some((term) => containsPhrase(itemTextLower, term));
    if (queryHit && itemHit) {
      lexicalBoost += 0.12;
    }
  });

  return clamp(tagScore * 0.72 + lexicalBoost, 0, 1);
};

const buildSemanticQueryPrompt = (query) => `You help a rental marketplace search engine understand user intent.
Rewrite the query into concise JSON only.

Return this shape:
{
  "searchText": "short product-focused search phrase",
  "keywords": ["term1", "term2", "term3"],
  "intent": "short natural language intent",
  "categoryHint": "optional broad category"
}

Rules:
- Keep the output general and useful for matching related listings.
- Do not invent specific accessories unless they are strongly implied.
- Prefer product names, use cases, and synonyms.
- Keep keywords short and practical.

User query: ${query}`;

const inferSemanticQueryPlan = async (query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return {
      searchText: "",
      keywords: [],
      intent: "",
      categoryHint: "",
    };
  }

  if (!GEMINI_API_KEY) {
    return {
      searchText: normalizedQuery,
      keywords: tokenize(normalizedQuery).slice(0, 8),
      intent: normalizedQuery,
      categoryHint: "",
    };
  }

  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [{ text: buildSemanticQueryPrompt(normalizedQuery) }],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": GEMINI_API_KEY },
    AI_SEARCH_QUERY_REWRITE_TIMEOUT_MS,
    "Gemini semantic search request timed out."
  );

  if (!response.ok) {
    return {
      searchText: normalizedQuery,
      keywords: tokenize(normalizedQuery).slice(0, 8),
      intent: normalizedQuery,
      categoryHint: "",
    };
  }

  const rawText = extractGeminiText(response.data);
  const parsed = extractJsonObject(rawText) || {};
  const searchText = normalizeText(
    parsed.searchText ||
      parsed.rewrittenQuery ||
      parsed.query ||
      extractLooseString(rawText, "searchText") ||
      normalizedQuery
  );
  const intent = normalizeText(parsed.intent || extractLooseString(rawText, "intent") || "");
  const categoryHint = normalizeText(
    parsed.categoryHint || extractLooseString(rawText, "categoryHint") || ""
  );
  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean).slice(0, 8)
    : [];
  const mergedKeywords = [...new Set([...keywords, ...tokenize(searchText).slice(0, 5)])]
    .filter(Boolean)
    .slice(0, 8);

  return {
    searchText: searchText || normalizedQuery,
    keywords: mergedKeywords,
    intent: intent || normalizedQuery,
    categoryHint,
  };
};

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

const rankItemsByEmbeddings = async ({ query, queryPlan, candidates }) => {
  if (!GEMINI_API_KEY) {
    return { ok: false, reason: "GEMINI_API_KEY is not set for embeddings." };
  }

  const requests = [
    buildEmbeddingRequest({
      text: isEmbeddingModelV2
        ? `Search query: ${buildQueryEmbeddingText({ query, queryPlan })}`
        : buildQueryEmbeddingText({ query, queryPlan }),
      taskType: "RETRIEVAL_QUERY",
    }),
    ...candidates.map((item) =>
      buildEmbeddingRequest({
        text: isEmbeddingModelV2
          ? `Search document: ${buildItemEmbeddingText(item)}`
          : buildItemEmbeddingText(item),
        taskType: "RETRIEVAL_DOCUMENT",
        title: normalizeText(item?.name),
      })
    ),
  ];

  const response = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
    {
      requests,
    },
    { "x-goog-api-key": GEMINI_API_KEY },
    AI_SEARCH_EMBEDDING_TIMEOUT_MS,
    "Gemini embedding request timed out."
  );

  if (!response.ok) {
    return response;
  }

  const embeddings = Array.isArray(response.data?.embeddings) ? response.data.embeddings : [];
  if (embeddings.length !== requests.length) {
    return {
      ok: false,
      reason: "Gemini returned an incomplete embedding payload.",
    };
  }

  const queryVector = getEmbeddingVector(embeddings[0]);
  const itemVectors = embeddings.slice(1).map(getEmbeddingVector);
  if (!queryVector.length || itemVectors.some((vector) => !vector.length)) {
    return {
      ok: false,
      reason: "Gemini returned an unreadable embedding payload.",
    };
  }

  const rankedItems = candidates
    .map((item, index) => {
      const embeddingSimilarity = cosineSimilarity(queryVector, itemVectors[index]);
      const embeddingScore = scoreEmbeddingSimilarity(embeddingSimilarity);
      const lexicalScore = scoreLexically({ queryPlan, item });
      const capabilityScore = scoreCapabilitySimilarity({ queryPlan, item });
      const semanticScore = clamp(
        embeddingScore * 0.35 + lexicalScore * 0.15 + capabilityScore * 0.5,
        0,
        1
      );
      return {
        ...item,
        semanticScore: Number(semanticScore.toFixed(4)),
        semanticReason: buildSemanticReason({ queryPlan, item, embeddingScore }),
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
    items: matchedItems.length ? matchedItems : rankedItems.slice(0, Math.min(6, rankedItems.length)),
    rankedItems,
    source: GEMINI_EMBEDDING_MODEL,
  };
};

const scoreLexically = ({ queryPlan, item }) => {
  const searchText = normalizeText(
    [queryPlan.searchText, queryPlan.intent, queryPlan.categoryHint, ...queryPlan.keywords]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();
  const itemText = buildItemSearchText(item).toLowerCase();

  if (!searchText || !itemText) return 0;

  const searchTokens = tokenize(searchText);
  const itemTokens = tokenize(itemText);
  if (!searchTokens.length || !itemTokens.length) return 0;

  const tokenScore = scoreTokenSimilarity(searchTokens, itemTokens);
  const charScore = scoreCharacterSimilarity(searchText, itemText);
  const capabilityScore = scoreCapabilitySimilarity({ queryPlan, item });
  let score = tokenScore * 0.4 + charScore * 0.22 + capabilityScore * 0.38;

  if (itemText.includes(searchText)) {
    score += 0.22;
  }

  const searchStemTokens = searchTokens.map(normalizeToken);
  const itemStemTokens = itemTokens.map(normalizeToken);
  const stemScore = scoreTokenSimilarity(searchStemTokens, itemStemTokens);
  score += stemScore * 0.12;

  if (queryPlan.categoryHint) {
    const categoryHint = queryPlan.categoryHint.toLowerCase();
    if (itemText.includes(categoryHint)) {
      score += 0.04;
    }
  }

  if (queryPlan.searchText) {
    const searchPhrase = queryPlan.searchText.toLowerCase();
    if (itemText.includes(searchPhrase)) {
      score += 0.18;
    }
  }

  if (queryPlan.intent) {
    const intentText = queryPlan.intent.toLowerCase();
    score += scoreCharacterSimilarity(intentText, itemText) * 0.08;
  }

  return clamp(score, 0, 1);
};

const buildRankingPrompt = ({ query, queryPlan, candidates, maxResults }) => {
  const candidateLines = candidates
    .map((candidate) => {
      const priceText =
        candidate.pricePerDay !== undefined && candidate.pricePerDay !== null
          ? ` price/day INR ${candidate.pricePerDay}`
          : "";
      return `[${candidate.index}] ${candidate.name} | ${candidate.category}${priceText} | ${candidate.description}`;
    })
    .join("\n");

  return `You are ranking rental marketplace search results.
Return JSON only.

Query:
${query}

Search plan:
${JSON.stringify(queryPlan)}

Candidate listings:
${candidateLines}

Return this exact shape:
{
  "searchText": "short product-focused search phrase",
  "keywords": ["term1", "term2"],
  "intent": "short natural language intent",
  "categoryHint": "optional broad category",
  "ranking": [
    { "index": 0, "score": 0.97, "reason": "short reason" }
  ]
}

Rules:
- Rank only the candidate listings shown above.
- Use the candidate index values exactly as provided.
- Score from 0 to 1.
- Favor listings that best satisfy the request, not just keyword overlap.
- Include at most ${maxResults} ranking entries.
- If nothing fits well, return an empty ranking array.`;
};

const parseGeminiRanking = (rawText = "") => {
  const parsed = extractJsonObject(rawText);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const rankingSource = Array.isArray(parsed.ranking)
    ? parsed.ranking
    : Array.isArray(parsed.items)
      ? parsed.items
      : [];

  const ranking = rankingSource
    .map((entry) => {
      const index = Number(entry?.index ?? entry?.candidateIndex ?? entry?.position);
      if (!Number.isInteger(index)) return null;

      const score = clamp(
        Number(entry?.score ?? entry?.similarity ?? entry?.matchScore ?? 0),
        0,
        1
      );
      return {
        index,
        score: Number.isFinite(score) ? score : 0,
        reason: normalizeText(entry?.reason || entry?.explanation || ""),
      };
    })
    .filter(Boolean);

  return {
    searchText: normalizeText(
      parsed.searchText || extractLooseString(rawText, "searchText") || ""
    ),
    intent: normalizeText(parsed.intent || extractLooseString(rawText, "intent") || ""),
    categoryHint: normalizeText(
      parsed.categoryHint || extractLooseString(rawText, "categoryHint") || ""
    ),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean).slice(0, 8)
      : [],
    ranking,
  };
};

const rankLexicalFallback = ({ queryPlan, candidates }) =>
  candidates
    .map((item) => {
      const semanticScore = scoreLexically({ queryPlan, item });
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

export const shouldUseSemanticSearch = (query) => looksLikeNaturalLanguageQuery(query);

export const rankItemsBySemanticSearch = async ({ query, items = [] }) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { ok: false, reason: "Query is empty." };
  }

  if (!looksLikeNaturalLanguageQuery(normalizedQuery)) {
    return { ok: false, reason: "Query does not look like natural language." };
  }

  const candidates = items
    .filter((item) => item && item.isActive !== false && item.availabilityStatus === "Available")
    .slice(0, Math.max(1, AI_SEARCH_MAX_CANDIDATES));

  if (!candidates.length) {
    return { ok: true, items: [], rankedItems: [], source: GEMINI_API_KEY ? GEMINI_MODEL : "lexical" };
  }

  const queryPlan = await inferSemanticQueryPlan(normalizedQuery);
  const lexicalRanked = rankLexicalFallback({ queryPlan, candidates });
  const topCandidates = lexicalRanked.slice(
    0,
    Math.min(AI_SEARCH_GEMINI_CANDIDATE_LIMIT, lexicalRanked.length)
  );

  const embeddingRanked = await rankItemsByEmbeddings({
    query: normalizedQuery,
    queryPlan,
    candidates,
  });
  if (embeddingRanked.ok) {
    return embeddingRanked;
  }

  if (!GEMINI_API_KEY) {
    const matchedItems = lexicalRanked.filter((item) => item.semanticScore >= AI_SEARCH_MIN_SIMILARITY);
    return {
      ok: true,
      items: matchedItems.length ? matchedItems : lexicalRanked.slice(0, Math.min(6, lexicalRanked.length)),
      rankedItems: lexicalRanked,
      source: "lexical",
    };
  }

  const rankingResponse = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildRankingPrompt({
                query: normalizedQuery,
                queryPlan,
                candidates: topCandidates.map((item, index) => ({
                  index,
                  name: normalizeText(item.name),
                  category: normalizeText(item.category),
                  description: normalizeText(item.description),
                  pricePerDay: item.pricePerDay,
                })),
                maxResults: AI_SEARCH_GEMINI_MAX_RESULTS,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
      },
    },
    { "x-goog-api-key": GEMINI_API_KEY },
    AI_SEARCH_TIMEOUT_MS,
    "Gemini semantic ranking request timed out."
  );

  if (!rankingResponse.ok) {
    const matchedItems = lexicalRanked.filter((item) => item.semanticScore >= AI_SEARCH_MIN_SIMILARITY);
    return {
      ok: true,
      items: matchedItems.length ? matchedItems : lexicalRanked.slice(0, Math.min(6, lexicalRanked.length)),
      rankedItems: lexicalRanked,
      source: "lexical-fallback",
      reason: rankingResponse.reason || "Gemini ranking failed.",
    };
  }

  const rawText = extractGeminiText(rankingResponse.data);
  const parsedRanking = parseGeminiRanking(rawText);
  if (!parsedRanking || !Array.isArray(parsedRanking.ranking)) {
    const matchedItems = lexicalRanked.filter((item) => item.semanticScore >= AI_SEARCH_MIN_SIMILARITY);
    return {
      ok: true,
      items: matchedItems.length ? matchedItems : lexicalRanked.slice(0, Math.min(6, lexicalRanked.length)),
      rankedItems: lexicalRanked,
      source: "lexical-fallback",
      reason: "Gemini returned an unreadable ranking payload.",
    };
  }

  const scoreByIndex = new Map();
  const reasonByIndex = new Map();
  parsedRanking.ranking.forEach((entry) => {
    scoreByIndex.set(entry.index, entry.score);
    if (entry.reason) {
      reasonByIndex.set(entry.index, entry.reason);
    }
  });

  const rankedItems = topCandidates
    .map((item, index) => {
      const fallbackScore = scoreLexically({ queryPlan, item });
      const semanticScore = scoreByIndex.has(index) ? scoreByIndex.get(index) : fallbackScore;
      return {
        ...item,
        semanticScore: Number(clamp(semanticScore, 0, 1).toFixed(4)),
        semanticReason: reasonByIndex.get(index) || "",
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
    items: matchedItems.length ? matchedItems : rankedItems.slice(0, Math.min(6, rankedItems.length)),
    rankedItems,
    source: GEMINI_MODEL,
  };
};
