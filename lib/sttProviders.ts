// STT provider abstraction — same interface shape as the artifact prototype.
// Two implementations:
//   1. WebSpeechSttProvider — browser-native, no key, kept as a fallback.
//   2. DeepgramSttProvider  — REAL implementation. Mints a short-lived
//      token from our own backend (/api/stt-token), then streams raw
//      PCM audio straight from the microphone to Deepgram over a
//      WebSocket the browser opens directly (token-authenticated).
//
// Deliberately uses raw PCM via ScriptProcessorNode rather than
// MediaRecorder: iOS Safari's MediaRecorder only supports audio/mp4
// (AAC), which Deepgram's live streaming endpoint does not accept.
// Raw linear16 PCM over Web Audio API works identically across
// Chrome, Firefox, and Safari/iOS — which is the whole point of this
// milestone.

export type SttCallbacks = {
  onSpeechStart?: () => void; // ready: first PCM block sent (Deepgram)
  onConnecting?: () => void;
  onStartupPhase?: (phase: "token" | "microphone" | "socket" | "capture") => void;
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onLevel?: (level: number) => void; // 0..1, for VAD/level meter UI
  onSilenceTimeout?: () => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
};

export interface SttProvider {
  name: string;
  costPerMinute: number;
  isSupported(): boolean;
  start(cb: SttCallbacks): void | Promise<void>;
  stop(): void;
}

/* ---------------- 1. Interim fallback: browser-native ---------------- */

export const WebSpeechSttProvider: SttProvider = (() => {
  let rec: any = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeCb: SttCallbacks | null = null;

  function resetSilenceTimer(cb: SttCallbacks) {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => cb.onSilenceTimeout?.(), 3500);
  }

  return {
    name: "webspeech (interim fallback, no key required)",
    costPerMinute: 0,
    isSupported() {
      if (typeof window === "undefined") return false;
      return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    },
    start(cb: SttCallbacks) {
      activeCb = cb;
      const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      rec = new Ctor();
      rec.lang = "es-CO";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let interim = "", final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        resetSilenceTimer(cb);
        if (interim) cb.onPartial?.(interim);
        if (final) cb.onFinal?.(final.trim());
      };
      rec.onerror = (e: any) => cb.onError?.(e.error || "unknown-error");
      rec.onend = () => { if (silenceTimer) clearTimeout(silenceTimer); cb.onEnd?.(); };
      try { rec.start(); cb.onSpeechStart?.(); } catch { cb.onError?.("start-failed"); return; }
      resetSilenceTimer(cb);
    },
    stop() {
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec?.stop(); } catch {}
    }
  };
})();

/* ---------------- 2. Real provider: Deepgram streaming ---------------- */

export const DeepgramSttProvider: SttProvider = (() => {
  let active = false;
  let generation = 0;
  let cleanup: (() => void) | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RECONNECTS = 2;

  function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return buffer;
  }

  async function connect(cb: SttCallbacks, attempt = 0) {
    const session = ++generation;
    const current = () => active && session === generation;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let socket: WebSocket | null = null;
    let processor: ScriptProcessorNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let gain: GainNode | null = null;
    let turnTimer: ReturnType<typeof setTimeout> | null = null;
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    let transcript = "";
    let ready = false;
    let disposed = false;
    const cancelTurn = () => {
      if (turnTimer) clearTimeout(turnTimer);
      turnTimer = null;
    };
    const dispose = () => {
      disposed = true;
      cancelTurn();
      if (startupTimer) clearTimeout(startupTimer);
      transcript = "";
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
        try { socket.close(); } catch {}
      }
      if (ctx) ctx.onstatechange = null;
      if (processor) processor.onaudioprocess = null;
      for (const node of [source, processor, analyser, gain]) {
        try { node?.disconnect(); } catch {}
      }
      stream?.getTracks().forEach(track => track.stop());
      if (ctx) void ctx.close().catch(() => {});
    };
    cleanup = dispose;
    const fail = (code: string, retry = false) => {
      if (!current() || disposed) return;
      dispose();
      if (retry && attempt < MAX_RECONNECTS) {
        cb.onConnecting?.();
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (current()) void connect(cb, attempt + 1);
        }, 500 * (attempt + 1));
      } else {
        active = false;
        cb.onError?.(code);
      }
    };
    cb.onConnecting?.();
    try {
      const response = await fetch("/api/stt-token");
      if (!current()) return;
      if (!response.ok) throw new Error("token-endpoint-failed");
      const data = await response.json();
      if (!current()) return;
      if (typeof data.token !== "string" || !data.token) throw new Error("token-endpoint-failed");
      cb.onStartupPhase?.("token");
      // The endpoint returns an existing API key; no minted-key propagation wait.
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1,
      } });
      if (!current()) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired;
      cb.onStartupPhase?.("microphone");
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === "suspended") await ctx.resume();
      if (!current()) return;
      if (ctx.state !== "running") throw new Error("audio-context-not-running");
      const audio = ctx;
      source = audio.createMediaStreamSource(stream);
      analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const url = `wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&interim_results=true&smart_format=true&utterance_end_ms=1200&vad_events=true&punctuate=true&encoding=linear16&sample_rate=${audio.sampleRate}&channels=1`;
      socket = new WebSocket(url, ["token", data.token]);
      const ws = socket;
      ws.binaryType = "arraybuffer";
      startupTimer = setTimeout(() => fail("voice-startup-timeout", true), 10000);
      audio.onstatechange = () => {
        if (current() && ready && audio.state !== "running") fail("audio-context-not-running");
      };
      ws.onopen = () => {
        if (!current() || disposed) return;
        cb.onStartupPhase?.("socket");
        try {
          processor = audio.createScriptProcessor(4096, 1, 1);
          gain = audio.createGain();
          gain.gain.value = 0;
          processor.onaudioprocess = event => {
            if (!current() || disposed || audio.state !== "running" || ws.readyState !== WebSocket.OPEN) return;
            try {
              ws.send(floatTo16BitPCM(event.inputBuffer.getChannelData(0)));
              if (!ready) {
                ready = true;
                if (startupTimer) clearTimeout(startupTimer);
                cb.onStartupPhase?.("capture");
                cb.onSpeechStart?.();
              }
              const levels = new Uint8Array(analyser!.frequencyBinCount);
              analyser!.getByteFrequencyData(levels);
              cb.onLevel?.(Math.min(1, levels.reduce((sum, value) => sum + value, 0) / levels.length / 90));
            } catch { fail("network", true); }
          };
          source!.connect(processor);
          processor.connect(gain);
          gain.connect(audio.destination);
        } catch { fail("audio-capture-failed"); }
      };
      ws.onmessage = event => {
        if (!current() || disposed) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "SpeechStarted") { cancelTurn(); return; }
          if (msg.type === "UtteranceEnd") {
            cancelTurn();
            turnTimer = setTimeout(() => {
              turnTimer = null;
              if (!current() || disposed) return;
              const complete = transcript.trim();
              transcript = "";
              if (complete) cb.onFinal?.(complete);
            }, 900);
            return;
          }
          const text = msg.channel?.alternatives?.[0]?.transcript || "";
          if (!text) return;
          cancelTurn();
          if (msg.is_final) transcript += (transcript ? " " : "") + text;
          cb.onPartial?.(msg.is_final ? transcript : (transcript + " " + text).trim());
        } catch { /* Ignore non-JSON frames. */ }
      };
      ws.onerror = () => fail("network", true);
      ws.onclose = () => fail("connection-closed", true);
    } catch (error) {
      fail(error instanceof Error ? error.message : "voice-start-failed");
    }
  }

  return {
    name: "deepgram (nova-3 streaming)",
    costPerMinute: 0.0043,
    isSupported() {
      return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && "WebSocket" in window;
    },
    async start(cb: SttCallbacks) {
      if (active) return;
      active = true;
      await connect(cb);
    },
    stop() {
      active = false;
      generation++;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      cleanup?.();
      cleanup = null;
    },
  };
})();

export function pickSttProvider(): SttProvider | null {
  if (DeepgramSttProvider.isSupported()) return DeepgramSttProvider;
  if (WebSpeechSttProvider.isSupported()) return WebSpeechSttProvider;
  return null;
}
