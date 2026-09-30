import { supabaseAdmin as supabase } from "./supabase";

export type LearningEventType =
  | "vocabulary"
  | "grammar"
  | "pronunciation"
  | "expression"
  | "comprehension";

export type LearningEvent = {
  id: string;
  type: LearningEventType;
  original: string;
  correction?: string;
  meaning?: string;
  explanation?: string;
  importance: number;
  mastery: number;
  timesSeen: number;
  createdAt: string;
  updatedAt: string;
};

export type LearningExtraction = {
  events: Array<{
    type: LearningEventType;
    original: string;
    correction?: string;
    meaning?: string;
    explanation?: string;
    importance: number;
  }>;
};

export const LEARNING_SYSTEM_PROMPT = `
You are the learning-analysis system for an AI Spanish tutor.

Analyze what the student says during a Spanish conversation and identify useful learning moments.

Extract only genuine learning opportunities such as:
- vocabulary the student appears to need
- important grammar mistakes
- incorrect or unnatural Spanish expressions
- comprehension difficulties
- useful Colombian expressions that came up naturally

Do NOT save:
- every small mistake
- obvious speech-to-text errors
- stylistic differences that are already natural Spanish
- personal facts about the student
- filler conversation
- repeated versions of the same learning point

MULTIPLE LEARNING EVENTS:
- A single student message may contain multiple independent learning opportunities.
- Identify ALL genuinely useful learning opportunities in the message, not only the most important one.
- Create a SEPARATE event for each distinct mistake or learning point.
- If the student makes two different grammar mistakes, return two events.
- If the student makes a grammar mistake and a vocabulary mistake, return two events.
- Do not combine unrelated mistakes into one event.
- Do not create duplicate events for the same underlying mistake.
- Ignore tiny stylistic issues, but do not discard a real mistake merely because another more important mistake exists.

Example:
Student: "Ayer yo voy al gimnasio y después yo comí con mis amigo."

This contains at least two distinct learning points:
1. "voy" -> "fui" because "ayer" requires past tense here.
2. "mis amigo" -> "mis amigos" because the noun must agree with "mis".

Return BOTH as separate objects inside the "events" array.

For each learning event:
- type must be vocabulary, grammar, pronunciation, expression, or comprehension
- original should contain the relevant student wording
- correction should contain improved Spanish when applicable
- meaning should contain a short English meaning when useful
- explanation should be short and practical
- importance should be an integer from 1 to 10

Return ONLY valid JSON in this exact structure:

{
  "events": [
    {
      "type": "grammar",
      "original": "Yo vivo aquí desde tres años",
      "correction": "Vivo aquí desde hace tres años",
      "meaning": "",
      "explanation": "Use 'desde hace' for an action or situation continuing for a duration.",
      "importance": 8
    }
  ]
}

If there is nothing genuinely useful to save, return:

{"events":[]}
`;

export async function extractLearningEvents(
  message: string,
  apiKey: string
): Promise<LearningExtraction["events"]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: LEARNING_SYSTEM_PROMPT,
     messages: [
  {
    role: "user",
    content: `Analyze the ENTIRE student message below.

You must scan from beginning to end before producing your answer.
Return a separate learning event for EVERY distinct genuine learning mistake.
Do not stop after finding the first mistake.
If there are 2 distinct mistakes, return 2 event objects.
If there are 3 distinct mistakes, return 3 event objects.

STUDENT MESSAGE:
${message}`,
  },
],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Learning extraction API error:", data);
    return [];
  }

  const text =
    data.content?.find((item: any) => item.type === "text")?.text ?? "";

  try {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      console.error("Learning extraction returned no JSON:", text);
      return [];
    }

    const jsonText = text.slice(firstBrace, lastBrace + 1);
    const parsed = JSON.parse(jsonText) as LearningExtraction;

    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch (error) {
    console.error("Learning extraction JSON parse failed:", error, text);
    return [];
  }
}

export async function saveLearningEvents(
  events: LearningExtraction["events"]
) {
  if (!events || events.length === 0) return;

  const rows = events.map((event) => ({
    type: event.type,
    original: event.original,
    correction: event.correction ?? null,
    meaning: event.meaning ?? null,
    explanation: event.explanation ?? null,
    importance: event.importance ?? 5,
    mastery: 0,
    review_count: 0,
    next_review_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("learning_events")
    .insert(rows);

  if (error) {
    console.error("Error saving Cami learning events:", error);
    return;
  }

  console.log("Cami learning events saved to Supabase:", rows);
}export async function loadDueLearningEvents(limit = 10) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("learning_events")
    .select("*")
    .lte("next_review_at", now)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error loading due learning events:", error);
    return [];
  }

  return data ?? [];
}export async function testLoadDueLearningEvents() {
  const events = await loadDueLearningEvents();
  console.log("Due learning events:", events);
  return events;
}
export async function updateLearningReview(
  id: string,
  correct: boolean,
  currentMastery: number,
  currentReviewCount: number
) {
  const newReviewCount = currentReviewCount + 1;

  const newMastery = correct
    ? Math.min(currentMastery + 1, 5)
    : Math.max(currentMastery - 1, 0);

  let delayMinutes: number;

  if (!correct) {
    delayMinutes = 10;
  } else {
    const intervals = [
      60,       // mastery 0
      1440,     // mastery 1 = 1 day
      4320,     // mastery 2 = 3 days
      10080,    // mastery 3 = 7 days
      20160,    // mastery 4 = 14 days
      43200,    // mastery 5 = 30 days
    ];

    delayMinutes = intervals[newMastery];
  }

  const nextReview = new Date(
    Date.now() + delayMinutes * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("learning_events")
    .update({
      mastery: newMastery,
      review_count: newReviewCount,
      next_review_at: nextReview,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating learning review:", error);
    throw error;
  }

  return data;
}
