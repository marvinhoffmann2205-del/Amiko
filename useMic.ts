"use client";
import { useCallback, useRef, useState } from "react";
import { pickSttProvider, SttProvider } from "@/lib/sttProviders";
import { createSttTelemetry, SttTelemetryOps, SttTelemetryState } from "@/lib/sttTelemetry";

export type MicState = "idle" | "requesting-permission" | "listening" | "error";

export function useMic(onFinalText: (text: string) => void) {
  const providerRef = useRef<SttProvider | null>(null);
  const [state, setState] = useState<MicState>("idle");
  const [partial, setPartial] = useState("");
  const [level, setLevel] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<SttTelemetryState>(createSttTelemetry());

  if (!providerRef.current && typeof window !== "undefined") {
    providerRef.current = pickSttProvider();
    if (providerRef.current) {
      SttTelemetryOps.setProvider(telemetry, providerRef.current.name, providerRef.current.costPerMinute);
    }
  }

  const bumpTelemetry = useCallback(() => setTelemetry(t => ({ ...t })), []);

  const stop = useCallback(() => {
    providerRef.current?.stop();
    SttTelemetryOps.stopClock(telemetry);
    bumpTelemetry();
    setPartial("");
    setLevel(0);
    setState("idle");
  }, [telemetry, bumpTelemetry]);

  const start = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) { setLastError("unsupported"); return; }
    if (state === "listening") return;
    setState("requesting-permission");
    SttTelemetryOps.startClock(telemetry);
    bumpTelemetry();

    await provider.start({
      onSpeechStart: () => {
        setState("listening");
        window.AmivoVoice?.interruptPlayback?.(); // barge-in hook, inert until Phase 3B/4
      },
      onPartial: (text) => setPartial(text),
      onFinal: (text) => {
        setPartial("");
        SttTelemetryOps.recordFinal(telemetry, text);
        bumpTelemetry();
        onFinalText(text);
      },
      onLevel: (l) => setLevel(l),
      onSilenceTimeout: () => {},
      onError: (code) => {
        setLastError(code);
        setState("error");
        if (code !== "no-speech") stop();
      },
      onEnd: () => {}
    });
  }, [state, telemetry, bumpTelemetry, stop, onFinalText]);

  return {
    supported: !!providerRef.current,
    providerName: providerRef.current?.name || "unsupported",
    state, partial, level, lastError, telemetry,
    start, stop
  };
}
