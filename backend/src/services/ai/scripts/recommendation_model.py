#!/usr/bin/env python3
import json
import math
import re
import sys
from collections import Counter, defaultdict

WORD_RE = re.compile(r"[a-z0-9]+")
NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")
WHITESPACE_RE = re.compile(r"\s+")

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "but",
    "by",
    "can",
    "could",
    "do",
    "for",
    "from",
    "has",
    "have",
    "how",
    "i",
    "if",
    "in",
    "is",
    "it",
    "its",
    "just",
    "like",
    "may",
    "me",
    "more",
    "most",
    "not",
    "of",
    "on",
    "or",
    "our",
    "please",
    "should",
    "so",
    "that",
    "the",
    "their",
    "them",
    "there",
    "these",
    "they",
    "this",
    "to",
    "use",
    "used",
    "using",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "would",
    "your",
    "you",
}

WORD_WEIGHT_BY_FIELD = {
    "name": 5,
    "category": 3,
    "description": 1,
}

CHAR_WEIGHT_BY_FIELD = {
    "name": 4,
    "category": 2,
    "description": 1,
}

MAX_RECOMMENDATIONS = 5
MIN_SCORE = 0.08
MAX_RELATED_TERMS = 8
MAX_REASON_TERMS = 3


def normalize_text(value):
    return WHITESPACE_RE.sub(" ", str(value or "")).strip().lower()


def tokenize(text):
    tokens = []
    for token in WORD_RE.findall(normalize_text(text)):
        if token in STOPWORDS:
            continue
        if len(token) == 1 and not token.isdigit():
            continue
        tokens.append(token)
    return tokens


def char_ngrams(text, min_n=3, max_n=5):
    normalized = NON_ALNUM_RE.sub(" ", normalize_text(text))
    normalized = f" {normalized} "
    grams = []
    for n in range(min_n, max_n + 1):
        if len(normalized) < n:
            continue
        for index in range(len(normalized) - n + 1):
            gram = normalized[index : index + n]
            if gram.strip() and "  " not in gram:
                grams.append(gram)
    return grams


def weighted_terms(item, field_weights):
    tokens = []
    for field, weight in field_weights.items():
        field_tokens = tokenize(item.get(field))
        if not field_tokens:
            continue
        for _ in range(weight):
            tokens.extend(field_tokens)
    return tokens


def weighted_chars(item, field_weights):
    chars = []
    for field, weight in field_weights.items():
        field_text = normalize_text(item.get(field))
        if not field_text:
            continue
        repeated_text = " ".join([field_text] * weight)
        chars.extend(char_ngrams(repeated_text))
    return chars


def build_idf(documents):
    df = defaultdict(int)
    total_docs = len(documents)

    for doc in documents:
        for term in set(doc):
            df[term] += 1

    idf = {}
    for term, count in df.items():
        idf[term] = math.log((1 + total_docs) / (1 + count)) + 1.0
    return idf


def build_tfidf_vector(doc, idf):
    counts = Counter(doc)
    vector = {}
    for term, count in counts.items():
        if term not in idf:
            continue
        tf = 1.0 + math.log(count)
        vector[term] = tf * idf[term]
    return vector


def cosine_similarity(vec_a, vec_b):
    if not vec_a or not vec_b:
        return 0.0

    if len(vec_a) > len(vec_b):
        vec_a, vec_b = vec_b, vec_a

    dot = 0.0
    for term, value in vec_a.items():
        dot += value * vec_b.get(term, 0.0)

    norm_a = math.sqrt(sum(value * value for value in vec_a.values()))
    norm_b = math.sqrt(sum(value * value for value in vec_b.values()))
    if not norm_a or not norm_b:
        return 0.0

    return dot / (norm_a * norm_b)


def build_term_graph(documents):
    term_docs = defaultdict(int)
    pair_counts = defaultdict(lambda: defaultdict(int))

    for doc in documents:
        unique_terms = sorted(set(doc))
        for term in unique_terms:
            term_docs[term] += 1
        for index, term in enumerate(unique_terms):
            for other in unique_terms[index + 1 :]:
                pair_counts[term][other] += 1
                pair_counts[other][term] += 1

    return term_docs, pair_counts


def build_related_terms(seed_terms, term_docs, pair_counts):
    related = []
    seen = set(seed_terms)

    for seed_term in seed_terms:
        neighbors = pair_counts.get(seed_term, {})
        for term, count in neighbors.items():
            if term in seen:
                continue
            if not term_docs.get(term):
                continue
            score = count / term_docs[term]
            related.append((term, score))

    related.sort(key=lambda item: item[1], reverse=True)

    unique = []
    for term, score in related:
        if term in seen:
            continue
        if term in [entry[0] for entry in unique]:
            continue
        unique.append((term, score))
        if len(unique) >= MAX_RELATED_TERMS:
            break

    return unique


def expand_query(seed_terms, related_terms):
    expanded = list(seed_terms)
    for term, score in related_terms:
        repeats = 1 + int(min(2, score * 2))
        expanded.extend([term] * repeats)
    return expanded


def shared_terms(seed_terms, candidate_terms, limit=MAX_REASON_TERMS):
    seed_set = set(seed_terms)
    shared = []
    for term in candidate_terms:
        if term in seed_set and term not in shared:
            shared.append(term)
        if len(shared) >= limit:
            break
    return shared


def build_reason(seed_item, candidate, shared, related_terms):
    seed_name = normalize_text(seed_item.get("name"))
    candidate_name = normalize_text(candidate.get("name"))
    parts = []

    if shared:
        parts.append(f"shared terms like {', '.join(shared)}")

    if related_terms:
        parts.append(f"context terms like {', '.join(term for term, _ in related_terms[:MAX_REASON_TERMS])}")

    if not parts and seed_name and candidate_name:
        parts.append("closest catalog match based on item context")

    reason = " and ".join(parts) if parts else "closest catalog match based on item context"
    return reason[:1].upper() + reason[1:] + "."


def rank_items(payload):
    seed_item = payload.get("seedItem") or {}
    candidates = payload.get("candidates") or []
    max_recommendations = int(payload.get("maxRecommendations") or MAX_RECOMMENDATIONS)

    if not candidates:
        return {"recommendations": []}

    seed_terms = weighted_terms(seed_item, WORD_WEIGHT_BY_FIELD)
    seed_chars = weighted_chars(seed_item, CHAR_WEIGHT_BY_FIELD)
    candidate_docs_terms = [weighted_terms(candidate, WORD_WEIGHT_BY_FIELD) for candidate in candidates]
    candidate_docs_chars = [weighted_chars(candidate, CHAR_WEIGHT_BY_FIELD) for candidate in candidates]

    all_word_docs = [seed_terms, *candidate_docs_terms]
    all_char_docs = [seed_chars, *candidate_docs_chars]

    word_idf = build_idf(all_word_docs)
    char_idf = build_idf(all_char_docs)
    term_docs, pair_counts = build_term_graph(all_word_docs)

    related_terms = build_related_terms(seed_terms, term_docs, pair_counts)
    expanded_query_terms = expand_query(seed_terms, related_terms)
    expanded_query_chars = expand_query(seed_chars, [])

    seed_vec = build_tfidf_vector(seed_terms, word_idf)
    seed_char_vec = build_tfidf_vector(seed_chars, char_idf)
    expanded_seed_vec = build_tfidf_vector(expanded_query_terms, word_idf)
    expanded_seed_char_vec = build_tfidf_vector(expanded_query_chars, char_idf)

    ranked = []
    seed_name = normalize_text(seed_item.get("name"))
    seed_category = normalize_text(seed_item.get("category"))

    for index, candidate in enumerate(candidates):
        candidate_terms = candidate_docs_terms[index]
        candidate_chars = candidate_docs_chars[index]
        candidate_vec = build_tfidf_vector(candidate_terms, word_idf)
        candidate_char_vec = build_tfidf_vector(candidate_chars, char_idf)

        direct_similarity = cosine_similarity(seed_vec, candidate_vec)
        direct_char_similarity = cosine_similarity(seed_char_vec, candidate_char_vec)
        expanded_similarity = cosine_similarity(expanded_seed_vec, candidate_vec)
        expanded_char_similarity = cosine_similarity(expanded_seed_char_vec, candidate_char_vec)

        same_name = normalize_text(candidate.get("name")) == seed_name
        same_category = seed_category and normalize_text(candidate.get("category")) == seed_category
        shared = shared_terms(seed_terms, candidate_terms)

        score = (
            (direct_similarity * 0.25)
            + (direct_char_similarity * 0.15)
            + (expanded_similarity * 0.35)
            + (expanded_char_similarity * 0.15)
            + min(0.12, len(shared) * 0.04)
        )

        if same_category:
            score += 0.03
        if same_name:
            score -= 0.25

        ranked.append(
            {
                "candidate": candidate,
                "score": max(0.0, min(1.0, score)),
                "shared": shared,
            }
        )

    ranked.sort(
        key=lambda entry: (
            entry["score"],
            str(entry["candidate"].get("createdAt") or ""),
        ),
        reverse=True,
    )

    recommendations = []
    seen_names = set()
    for entry in ranked:
        candidate = entry["candidate"]
        name = normalize_text(candidate.get("name"))
        if not name or name in seen_names:
            continue
        if entry["score"] < MIN_SCORE:
            continue

        seen_names.add(name)
        recommendations.append(
            {
                "name": candidate.get("name", "").strip(),
                "reason": build_reason(
                    seed_item,
                    candidate,
                    entry["shared"],
                    related_terms,
                ),
                "score": round(entry["score"], 4),
            }
        )

        if len(recommendations) >= max_recommendations:
            break

    return {"recommendations": recommendations}


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw or "{}")
    except json.JSONDecodeError as error:
        json.dump({"error": f"Invalid JSON payload: {error.msg}"}, sys.stdout)
        return 1

    result = rank_items(payload)
    json.dump(result, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
