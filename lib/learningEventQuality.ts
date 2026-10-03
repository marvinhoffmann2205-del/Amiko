/** Conservative eligibility rules. Never deletes or merges persisted learning history. */
export type QualityEvent = {
  original: string;
  correction?: string | null;
  meaning?: string | null;
  explanation?: string | null;
  review_count?: number;
  incorrect_streak?: number | null;
};

// Ignore keyboard accents, but keep ñ distinct from n (different Spanish letters).
export function normalizeLearningText(value: string): string {
  return value.normalize("NFD").replace(/[\u0301\u0308]/g, "")
    .normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ").trim();
}

export function learningEventQuality(event: QualityEvent): "keep" | "malformed" | "trivial" | "artifact" {
  if (typeof event?.original !== "string" || !/\p{L}/u.test(event.original)) return "malformed";
  if (event.correction != null && typeof event.correction !== "string") return "malformed";
  if ([event.meaning, event.explanation].some(value => value != null && typeof value !== "string")) return "malformed";
  const original = normalizeLearningText(event.original);
  const correction = normalizeLearningText(event.correction ?? "");
  if (!original) return "malformed";
  if (correction && original === correction) return "trivial";
  // A vocabulary/comprehension event may legitimately have no correction.
  if (!correction) {
    return [event.meaning, event.explanation].some(value => typeof value === "string" && /\p{L}/u.test(value))
      ? "keep" : "malformed";
  }
  // Repeated failed reviews are evidence of a weakness, even for a suspected typo.
  if ((event.incorrect_streak ?? 0) >= 2) return "keep";
  // Deliberately narrow: never treat arbitrary one-letter edits as typos (voy/soy, fui/fue).
  if (original.replace(/\bjo\b/g, "yo") === correction) return "artifact";
  const explanation = typeof event.explanation === "string" ? event.explanation.toLowerCase() : "";
  if (/^(?:(?:this is|likely|just|only)\s+)*(?:an?\s+)?(?:typo|transcription error|speech.to.text error|stt artifact|spelling slip)(?:[.:,]|$)/.test(explanation)) {
    return "artifact";
  }
  return "keep";
}

function duplicateKey(event: QualityEvent): string {
  let original = normalizeLearningText(event.original);
  let correction = normalizeLearningText(event.correction ?? "");
  // Optional explicit subject on BOTH sides is the same learning point.
  if (original.startsWith("yo ") && correction.startsWith("yo ")) {
    original = original.slice(3);
    correction = correction.slice(3);
  }
  // Correction-free events need matching instructional context before deduplicating.
  return JSON.stringify([original, correction, correction ? "" : normalizeLearningText(event.meaning ?? ""),
    correction ? "" : normalizeLearningText(event.explanation ?? "")]);
}

export function filterLearningEventQuality<T extends QualityEvent>(
  events: readonly T[], priority: (event: T) => number = () => 0
): T[] {
  const unique = new Map<string, T>();
  for (const event of events) {
    if (learningEventQuality(event) !== "keep") continue;
    const key = duplicateKey(event);
    const previous = unique.get(key);
    if (!previous || priority(event) > priority(previous)) unique.set(key, event);
  }
  return [...unique.values()];
}
