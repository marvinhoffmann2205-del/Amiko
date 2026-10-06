"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { pickSttProvider, SttProvider } from "@/lib/sttProviders";
import { createSttTelemetry, SttTelemetryOps, SttTelemetryState } from "@/lib/sttTelemetry";

export type MicState = "idle" | "connecting" | "listening" | "error";

export function useMic(onFinalText: (text: string) => void) {
  const providerRef = useRef<SttProvider | null>(null);
  const [state, setState] = useState<MicState>("idle");
  const [partial, setPartial] = useState("");
  const [level, setLevel] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const telemetryRef = useRef<SttTelemetryState>(createSttTelemetry());
  const [telemetry, setTelemetry] = useState(telemetryRef.current);
  const stateRef = useRef<MicState>("idle");
  const sessionRef = useRef(0);
  const finalRef = useRef(onFinalText);
  finalRef.current = onFinalText;

  if (!providerRef.current && typeof window !== "undefined") {
    providerRef.current = pickSttProvider();
    if (providerRef.current) {
      SttTelemetryOps.setProvider(telemetry, providerRef.current.name, providerRef.current.costPerMinute);
    }
  }

  const bumpTelemetry = useCallback(() => setTelemetry({ ...telemetryRef.current }), []);
  const transition = useCallback((next: MicState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const stop = useCallback(() => {
    sessionRef.current++;
    providerRef.current?.stop();
    SttTelemetryOps.stopClock(telemetryRef.current);
    bumpTelemetry();
    setPartial("");
    setLevel(0);
    transition("idle");
  }, [transition, bumpTelemetry]);

  useEffect(() => () => {
    sessionRef.current++;
    providerRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current === "listening" || stateRef.current === "connecting") return;
    const provider = providerRef.current;
    if (!provider) { setLastError("unsupported"); transition("error"); return; }
    const session = ++sessionRef.current;
    const current = () => session === sessionRef.current;
    transition("connecting");
    setLastError(null);
    setPartial("");
    SttTelemetryOps.requestStartup(telemetryRef.current);
    bumpTelemetry();
    const error = (code: string) => {
      if (!current()) return;
      sessionRef.current++;
      provider.stop();
      SttTelemetryOps.stopClock(telemetryRef.current);
      setLastError(code);
      setPartial("");
      setLevel(0);
      transition("error");
      bumpTelemetry();
    };
    try {
      await provider.start({
        onConnecting: () => {
          if (!current()) return;
          if (stateRef.current === "listening") SttTelemetryOps.requestStartup(telemetryRef.current);
          SttTelemetryOps.stopClock(telemetryRef.current);
          transition("connecting");
          setPartial("");
          setLevel(0);
          bumpTelemetry();
        },
        onStartupPhase: phase => {
          if (!current()) return;
          SttTelemetryOps.recordStartup(telemetryRef.current, phase);
          bumpTelemetry();
        },
        onSpeechStart: () => {
          if (!current()) return;
          transition("listening");
          SttTelemetryOps.startClock(telemetryRef.current);
          bumpTelemetry();
          window.AmivoVoice?.interruptPlayback?.();
        },
        onPartial: text => { if (current()) setPartial(text); },
        onFinal: text => {
          if (!current()) return;
          setPartial("");
          SttTelemetryOps.recordFinal(telemetryRef.current, text);
          bumpTelemetry();
          finalRef.current(text);
        },
        onLevel: value => { if (current()) setLevel(value); },
        onSilenceTimeout: () => {},
        onError: error,
        onEnd: () => {
          if (!current()) return;
          sessionRef.current++;
          SttTelemetryOps.stopClock(telemetryRef.current);
          transition("idle");
          setPartial("");
          setLevel(0);
          bumpTelemetry();
        },
      });
    } catch { error("voice-start-failed"); }
  }, [transition, bumpTelemetry]);

  return {
    supported: !!providerRef.current,
    providerName: providerRef.current?.name || "unsupported",
    state, partial, level, lastError, telemetry,
    start, stop
  };
}
