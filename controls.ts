import { Level, Session } from "./amivoEngine";

const MINI_DICT: Record<string, string> = {
  "hola": "hello", "gracias": "thank you", "por favor": "please", "¿cómo estás?": "how are you?",
  "me llamo": "my name is", "quiero": "I want", "necesito": "I need",
  "no entiendo": "I don't understand", "qué gusto": "nice to meet you"
};

export function controlAction(kind: string, level: Level, session: Session, lastCamiText: string | null): string {
  if (!lastCamiText) return "There's nothing to work with yet — say something first!";
  if (kind === "repeat") return lastCamiText;
  if (kind === "slower") {
    const firstClause = lastCamiText.split(/[.!?—]/)[0];
    return "Más despacio: " + firstClause.trim() + ".";
  }
  if (kind === "translate") {
    const found = Object.keys(MINI_DICT).filter(k => lastCamiText.toLowerCase().includes(k));
    return found.length
      ? found.map(k => `"${k}" = ${MINI_DICT[k]}`).join(", ")
      : "Roughly, I'm just reacting to what you said and keeping the conversation going.";
  }
  if (kind === "explain") {
    if (session.lastCorrection) {
      return `That's about ${session.lastCorrection.topic} — "${session.lastCorrection.wrong}" should be "${session.lastCorrection.right}".`;
    }
    return level === "Beginner"
      ? "Right now we're just focused on simple, natural sentences — no pressure on grammar yet."
      : "Nothing specific to explain yet — keep talking and I'll flag anything useful.";
  }
  return "";
}
