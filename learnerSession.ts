// Learning-data architecture — shape only, in-memory for now.
// Phase 6 (persistent learner memory) and Phase 7 (Learn) will point a
// real store (Supabase, etc.) at this exact shape rather than redesigning it.
// Nothing here is persisted across reloads yet — intentional, matches
// the current phase's scope (Talk only, no Learn/Progress).

import { Level, Session } from "./amivoEngine";

export type LearnerSession = {
  tutorId: string;
  level: Level;
  startedAt: number;
  engineSession: Session;      // AmivoEngine's own in-turn memory
  transcript: { from: "user" | "cami"; text: string; ts: number }[];
};

export function createLearnerSession(tutorId: string, level: Level): LearnerSession {
  return { tutorId, level, startedAt: Date.now(), engineSession: {}, transcript: [] };
}
