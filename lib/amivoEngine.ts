// AmivoEngine — one reusable engine, any TutorProfile.
//
// This is the SAME rule-based scaffolding approved in Phase 1, ported
// unchanged. Per the "do not expand the rule-based system further"
// instruction, nothing new has been added here — only moved.
//
// reactTo() is the single seam Phase 3A will replace with a real
// Anthropic API call (server-side, via an API route — never from the
// browser). Nothing that calls reactTo() needs to change when that
// happens; only this function's internals do.

import { TutorProfile } from "./tutors";

export type Level = "Beginner" | "Intermediate" | "Advanced";

export type Session = {
  turns?: number;
  name?: string;
  mistakeCounts?: Record<string, number>;
  lastCorrection?: { wrong: string; right: string; topic: string } | null;
  helpLangUsed?: string;
};

const IMPORTANT_MISTAKES: Record<string, boolean> = {
  "past tense (ir)": true,
  "ser conjugation": true
};

const CORRECTION_RULES = [
  { pattern: /\bayer yo voy\b/i, wrong: "ayer yo voy", right: "ayer yo fui", topic: "past tense (ir)",
    line: "Ahh, fuiste al gimnasio 😄. Una cosita: como hablas de ayer, decimos \"fui\", no \"voy\". ¿Qué entrenaste?" },
  { pattern: /\byo es\b/i, wrong: "yo es", right: "yo soy", topic: "ser conjugation",
    line: "Casi 😄 — decimos \"yo soy\", no \"yo es\". ¿Y qué más me ibas a contar?" },
  { pattern: /\byo tiene\b/i, wrong: "yo tiene", right: "yo tengo", topic: "tener conjugation",
    line: "Una cosita: es \"yo tengo\", no \"yo tiene\" 😊. Sigue, te escucho." }
];

const HELP_PHRASES = [
  /i don'?t understand/i, /i dont understand/i, /what does that mean/i, /can you repeat/i,
  /repeat that/i, /speak slower/i, /slower please/i, /i don'?t know what/i, /no entiendo/i, /qué significa/i
];

const BOUNDARY_PHRASES = [
  /you'?re beautiful/i, /go on a date/i, /be my girlfriend/i, /be my boyfriend/i,
  /i love you/i, /marry me/i, /are you single/i
];

function looksSpanish(t: string) {
  return /[áéíóúñ¿¡]/i.test(t) || /\b(el|la|de|que|yo|es|un|una|para|con|por|fui|voy)\b/i.test(t);
}

function detectName(t: string, session: Session) {
  const m = t.match(/\b(?:me llamo|my name is|i'?m)\s+([a-záéíóúñ]+)/i);
  if (m && m[1] && m[1].length > 1) session.name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
}

function detectMistake(t: string) {
  return CORRECTION_RULES.find(r => r.pattern.test(t)) || null;
}

export const AmivoEngine = {
  opening(tutor: TutorProfile, level: Level): string {
    return tutor.openingLines?.[level] || tutor.openingLines?.Beginner || "¡Hola!";
  },

  reactTo(tutor: TutorProfile, level: Level, userText: string, session: Session): string {
    session.turns = (session.turns || 0) + 1;
    detectName(userText, session);

    for (const phrase of BOUNDARY_PHRASES) {
      if (phrase.test(userText) && tutor.boundaryReplies?.length) {
        return tutor.boundaryReplies[Math.floor(Math.random() * tutor.boundaryReplies.length)];
      }
    }

    for (const phrase of HELP_PHRASES) {
      if (phrase.test(userText) && tutor.helpReplies) {
        session.helpLangUsed = "en";
        return (
          tutor.helpReplies.opening +
          "Just tell me what's confusing, or try repeating slowly: \"¿Cómo estás?\" — that means \"how are you?\"." +
          tutor.helpReplies.closing
        );
      }
    }

    const mistake = detectMistake(userText);
    if (mistake) {
      session.mistakeCounts = session.mistakeCounts || {};
      session.mistakeCounts[mistake.topic] = (session.mistakeCounts[mistake.topic] || 0) + 1;
      const isImportant = !!IMPORTANT_MISTAKES[mistake.topic];
      if (isImportant || session.mistakeCounts[mistake.topic] >= 2) {
        session.lastCorrection = mistake;
        return mistake.line;
      }
    }

    const pool = tutor.reactionPools?.[level] || tutor.reactionPools?.Beginner || ["¡Bien! ¿Qué más?"];
    const template = pool[Math.floor(Math.random() * pool.length)];
    const echo = looksSpanish(userText) ? "got it" : (userText.length > 40 ? userText.slice(0, 40) + "…" : userText);
    return template.replace("{echo}", echo);
  }
};
