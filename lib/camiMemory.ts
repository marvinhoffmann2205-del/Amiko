export type CamiMemory = {
  id: string;
  fact: string;
  category: string;
  importance: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoryExtraction = {
  memories: Array<{
    fact: string;
    category: string;
    importance: number;
  }>;
};

export const MEMORY_SYSTEM_PROMPT = `
You are the memory system for an AI language tutor.

Analyze what the student says and identify personal information
that would be genuinely useful to remember in future conversations.

Remember things such as:
- personal background
- where they are from or live
- work or studies
- family and relationships
- interests and hobbies
- preferences
- goals
- travel plans
- important ongoing life events
- meaningful stories or experiences

Do NOT save:
- filler conversation
- temporary remarks
- random one-off details
- guesses or assumptions
- information the student did not actually provide

Do not require predefined categories.
Choose a short useful category yourself.

Return only valid JSON in this format:

{
  "memories": [
    {
      "fact": "Student is from Germany",
      "category": "background",
      "importance": 8
    }
  ]
}

If nothing is worth remembering, return:

{"memories":[]}
`;
let memoryStore: MemoryExtraction["memories"] = [];

export function getMemories(): MemoryExtraction["memories"] {
  return memoryStore;
}

export function saveMemories(memories: MemoryExtraction["memories"]): void {
  for (const memory of memories) {
    const existing = memoryStore.find(
      (m) => m.fact.toLowerCase() === memory.fact.toLowerCase()
    );

    if (!existing) {
      memoryStore.push(memory);
    }
  }
}

export function formatMemoriesForCami(): string {
  if (memoryStore.length === 0) return "No saved student memories yet.";

  return memoryStore
    .sort((a, b) => b.importance - a.importance)
    .map((m) => `- ${m.fact}`)
    .join("\n");
}

export async function extractMemories(
  message: string,
  apiKey: string
): Promise<MemoryExtraction["memories"]> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: MEMORY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Memory extraction API error");
      return [];
    }

    const data = await response.json();
    const text =
      data.content?.find((item: any) => item.type === "text")?.text ?? "";

    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Claude may occasionally wrap valid JSON with extra text.
    // Extract the outer JSON object before parsing.
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      console.error("Memory extraction returned no JSON:", cleaned);
      return [];
    }

    const jsonText = cleaned.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonText) as MemoryExtraction;

    return Array.isArray(parsed.memories) ? parsed.memories : [];
  } catch (error) {
    console.error("Memory extraction failed:", error);
    return [];
  }
}
