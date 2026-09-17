// TTS provider abstraction — architecture placeholder only.
// Do NOT implement Cartesia/ElevenLabs here yet (that's Phase 3B).
// This exists now so nothing above this layer needs to change shape later.

export type TtsSpeakOptions = {
  text: string;
  voiceId?: string | null;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onError?: (message: string) => void;
};

export interface TtsProvider {
  name: string;
  costPerCharacter: number; // filled in once a real provider is wired up
  isSupported(): boolean;
  speak(opts: TtsSpeakOptions): Promise<void>;
  stop(): void; // required for barge-in — interrupting Cami mid-sentence
}

// Placeholder so imports resolve and the UI can show "voice reply not
// connected yet" instead of silently doing nothing.
export const NotImplementedTtsProvider: TtsProvider = {
  name: "not-implemented",
  costPerCharacter: 0,
  isSupported: () => false,
  async speak(opts) {
    opts.onError?.("TTS is not implemented yet — Phase 3B.");
  },
  stop() {}
};

// Global hook Phase 3B/4 barge-in will call from MicController when the
// learner starts talking while Cami's audio is playing. Wired now,
// inert until a real TtsProvider exists.
declare global {
  interface Window {
    AmivoVoice?: { interruptPlayback: () => void };
  }
}
