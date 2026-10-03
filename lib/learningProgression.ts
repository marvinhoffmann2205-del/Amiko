export type LearningReviewResult = "correct" | "almost" | "incorrect";

export type AttentionItem = {
  id: string;
  mastery: number;
  review_count: number;
  importance: number;
  next_review_at: string;
  created_at: string;
  last_result?: LearningReviewResult | null;
  incorrect_streak?: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function attentionScore(item: AttentionItem, now: number): number {
  const outcome = item.last_result === "incorrect" ? 12 : item.last_result === "almost" ? 6 : 0;
  const overdueDays = Math.min(7, Math.max(0, Math.floor((now - Date.parse(item.next_review_at)) / DAY_MS)));
  return 4 * (5 - item.mastery) + outcome
    + 3 * Math.min(3, Math.max(0, item.incorrect_streak ?? 0))
    + item.importance + overdueDays;
}

export function selectLearningAttention<T extends AttentionItem>(
  items: readonly T[], now = Date.now(), limit = 5
): T[] {
  const size = Math.max(0, Math.min(5, Math.floor(limit)));
  const due = items.filter(item => Date.parse(item.next_review_at) <= now);
  const stableOrder = (a: T, b: T) => Date.parse(a.created_at) - Date.parse(b.created_at)
    || a.id.localeCompare(b.id);
  const reviewed = due.filter(item => item.review_count > 0).sort((a, b) =>
    attentionScore(b, now) - attentionScore(a, now)
    || Date.parse(a.next_review_at) - Date.parse(b.next_review_at)
    || stableOrder(a, b));
  const fresh = due.filter(item => item.review_count === 0).sort((a, b) =>
    b.importance - a.importance || stableOrder(a, b));
  if (reviewed.length === 0) return fresh.slice(0, Math.min(2, size));
  const queue = reviewed.slice(0, Math.min(4, size));
  return [...queue, ...fresh.slice(0, Math.min(1, size - queue.length))];
}

export function reviewProgress(
  state: Pick<AttentionItem, "mastery" | "review_count" | "incorrect_streak">,
  result: LearningReviewResult, now = Date.now()
) {
  const mastery = Math.max(0, Math.min(5, state.mastery + (result === "correct" ? 2 : result === "almost" ? 1 : 0)));
  const correctIntervals = [60, 1440, 4320, 10080, 20160, 43200];
  const minutes = result === "incorrect" ? 10 : result === "almost" ? 30 : correctIntervals[mastery];
  return {
    mastery,
    review_count: state.review_count + 1,
    last_result: result,
    incorrect_streak: result === "incorrect" ? (state.incorrect_streak ?? 0) + 1 : 0,
    next_review_at: new Date(now + minutes * 60000).toISOString(),
    updated_at: new Date(now).toISOString(),
  };
}
