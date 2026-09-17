// TTS provider abstraction.
//
// CartesiaTtsProvider is the REAL implementation: the browser never
// talks to Cartesia directly. It calls our own /api/tts route, which
// holds CARTESIA_API_KEY server-side and returns synthesized audio
// bytes. This mirrors the STT pattern (browser -> our backend -> real
// provider), just without needing a short-lived token, since the
// browser never opens a direct connection to Cartesia itself.

export type TtsSpeakOptions = {
  text: string;
  tutorId?: string;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onError?: (message: string) => void;
};

export interface TtsProvider {
  name: string;
  costPerCharacter: number;
  isSupported(): boolean;
  speak(opts: TtsSpeakOptions): Promise<void>;
  stop(): void; // required for barge-in — interrupting Cami mid-sentence
  unlock?(): void; // call once, synchronously, inside a user-gesture handler (iOS autoplay)
}

export const NotImplementedTtsProvider: TtsProvider = {
  name: "not-implemented",
  costPerCharacter: 0,
  isSupported: () => false,
  async speak(opts) { opts.onError?.("TTS is not implemented yet."); },
  stop() {}
};

// A single shared <audio> element per tab. Reusing one element (rather
// than creating a new one per utterance) is what makes stop()/barge-in
// and the iOS autoplay "unlock" trick work reliably.
let sharedAudio: HTMLAudioElement | null = null;
function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio && typeof window !== "undefined") {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio as HTMLAudioElement;
}

let currentObjectUrl: string | null = null;

export const CartesiaTtsProvider: TtsProvider = {
  name: "cartesia (sonic)",
  costPerCharacter: 0.00003, // approximate — confirm against current Cartesia pricing

  isSupported() {
    return typeof window !== "undefined" && typeof Audio !== "undefined";
  },

  // iOS Safari blocks audio.play() unless it happens inside (or very
  // shortly after) a real user gesture. Call this once, synchronously,
  // from a button's onClick — e.g. the "Start Talking" button — before
  // any async work. It plays+immediately pauses a silent clip, which
  // is enough to "unlock" later programmatic play() calls for the rest
  // of the page's lifetime on iOS.
  unlock() {
    const audio = getSharedAudio();
    const prevSrc = audio.src;
    // A ~0.1s silent WAV, inlined so no network round-trip is needed to unlock.
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.play().then(() => audio.pause()).catch(() => {/* best-effort */});
    audio.src = prevSrc;
  },

  async speak(opts: TtsSpeakOptions) {
    const audio = getSharedAudio();
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: opts.text, tutorId: opts.tutorId || "cami" })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        opts.onError?.(body.error || "tts_request_failed");
        return;
      }
      const blob = await res.blob();
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = URL.createObjectURL(blob);
      audio.src = currentObjectUrl;
      audio.onplay = () => opts.onAudioStart?.();
      audio.onended = () => opts.onAudioEnd?.();
      audio.onerror = () => opts.onError?.("audio-playback-failed");
      await audio.play(); // may reject on iOS if unlock() was never called from a gesture
    } catch (err: any) {
      opts.onError?.(err?.name === "NotAllowedError" ? "autoplay-blocked" : "tts-network-error");
    }
  },

  stop() {
    const audio = getSharedAudio();
    try { audio.pause(); audio.currentTime = 0; } catch {}
  }
};

export function pickTtsProvider(): TtsProvider {
  return CartesiaTtsProvider.isSupported() ? CartesiaTtsProvider : NotImplementedTtsProvider;
}

// Global hook barge-in wiring calls when the learner starts talking
// while Cami's audio is playing. ChatScreen sets this once on mount.
declare global {
  interface Window {
    AmivoVoice?: { interruptPlayback: () => void };
  }
}

