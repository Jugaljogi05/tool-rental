const stripCodeFences = (text = "") => {
  const trimmed = `${text || ""}`.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
};

const extractBalancedJsonObject = (text = "") => {
  const input = `${text || ""}`;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (start === -1) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
};

const extractBalancedJsonObjects = (text = "") => {
  const input = `${text || ""}`;
  const results = [];

  for (let start = 0; start < input.length; start += 1) {
    if (input[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < input.length; index += 1) {
      const char = input[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          results.push(input.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return results;
};

const extractBalancedJsonArray = (text = "") => {
  const input = `${text || ""}`;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (start === -1) {
      if (char === "[") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
};

const decodePossiblyTruncatedJsonString = (value = "") => {
  const text = `${value || ""}`;
  try {
    return JSON.parse(`"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  } catch {
    return text
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
};

const extractLooseStringField = (text = "", fieldName = "") => {
  const input = `${text || ""}`;
  const fieldPattern = new RegExp(`"${fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`, "i");
  const match = fieldPattern.exec(input);
  if (!match) return "";

  let index = match.index + match[0].length;
  while (index < input.length && /\s/.test(input[index])) {
    index += 1;
  }

  if (input[index] !== '"') {
    return "";
  }

  index += 1;
  let escaped = false;
  let value = "";

  for (; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      value += `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return decodePossiblyTruncatedJsonString(value);
    }
    value += char;
  }

  return decodePossiblyTruncatedJsonString(value);
};

const extractJsonArraySubstring = (text = "", fieldName = "") => {
  const input = `${text || ""}`;
  const fieldPattern = new RegExp(`"${fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`, "i");
  const match = fieldPattern.exec(input);
  if (!match) return null;

  const afterField = input.slice(match.index + match[0].length);
  const arrayStart = afterField.indexOf("[");
  if (arrayStart === -1) return null;

  const extracted = extractBalancedJsonArray(afterField.slice(arrayStart));
  return extracted;
};

const collectJsonCandidates = (text = "") => {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return [];

  const candidates = [trimmed];
  const fencePattern = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;

  while ((match = fencePattern.exec(trimmed)) !== null) {
    const fenced = `${match[1] || ""}`.trim();
    if (fenced) candidates.push(fenced);
  }

  const stripped = stripCodeFences(trimmed);
  if (stripped !== trimmed) {
    candidates.push(stripped);
  }

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
};

export const extractGeminiText = (data = {}) => {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("").trim();
};

export const getGeminiFinishReason = (data = {}) => `${data.candidates?.[0]?.finishReason || ""}`.trim();

export const extractJsonObject = (text = "") => {
  if (text && typeof text === "object" && !Array.isArray(text)) {
    return text;
  }

  if (typeof text !== "string") return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = collectJsonCandidates(trimmed);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the balanced-object fallback below.
    }

    const balancedCandidates = extractBalancedJsonObjects(candidate);
    for (const balanced of balancedCandidates) {
      try {
        return JSON.parse(balanced);
      } catch {
        // Keep scanning other candidates.
      }
    }
  }

  return null;
};

export const extractLooseString = (text = "", fieldName = "") => extractLooseStringField(text, fieldName);

export const extractJsonArray = (text = "", fieldName = "") => {
  const input = `${text || ""}`;
  if (!input.trim()) return null;

  const candidates = collectJsonCandidates(input.trim());
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed?.[fieldName])) {
        return parsed[fieldName];
      }
    } catch {
      // Continue to the balanced array fallback below.
    }

    const arraySubstring = extractJsonArraySubstring(candidate, fieldName);
    if (!arraySubstring) continue;

    try {
      return JSON.parse(arraySubstring);
    } catch {
      // Keep scanning other candidates.
    }
  }

  return null;
};
