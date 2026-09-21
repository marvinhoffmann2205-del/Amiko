export type TurnDecision = "WAIT" | "RESPOND";

export function detectTurnEnd(text: string): TurnDecision {
  const clean = text.trim();

  if (!clean) return "WAIT";

  const words = clean.split(/\s+/);

  if (words.length <= 2) return "WAIT";

  const unfinished = [
    "y", "o", "pero", "porque", "que",
    "cuando", "entonces", "como", "con",
    "para", "por", "de", "del", "a", "al", "en"
  ];

  const lastWord = words[words.length - 1]
    .toLowerCase()
    .replace(/[.,!?¿¡]/g, "");

  if (unfinished.includes(lastWord)) return "WAIT";

  return "RESPOND";
}
