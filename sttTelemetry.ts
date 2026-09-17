// STT usage + cost telemetry — provider-agnostic, ported from the artifact.
// Swap costPerMinute when a real metered provider is active; nothing else changes.

export type SttTelemetryState = {
  provider: string;
  costPerMinute: number;
  listenStartedAt: number | null;
  totalListenMs: number;
  finalCount: number;
  totalChars: number;
};

export function createSttTelemetry(): SttTelemetryState {
  return { provider: "none", costPerMinute: 0, listenStartedAt: null, totalListenMs: 0, finalCount: 0, totalChars: 0 };
}

export const SttTelemetryOps = {
  setProvider(t: SttTelemetryState, name: string, costPerMinute = 0) {
    t.provider = name; t.costPerMinute = costPerMinute;
  },
  startClock(t: SttTelemetryState) { t.listenStartedAt = Date.now(); },
  stopClock(t: SttTelemetryState) {
    if (t.listenStartedAt) { t.totalListenMs += Date.now() - t.listenStartedAt; t.listenStartedAt = null; }
  },
  recordFinal(t: SttTelemetryState, text: string) { t.finalCount += 1; t.totalChars += text.length; },
  estimateCost(t: SttTelemetryState) {
    const liveMs = t.totalListenMs + (t.listenStartedAt ? Date.now() - t.listenStartedAt : 0);
    return (liveMs / 60000) * t.costPerMinute;
  },
  liveMs(t: SttTelemetryState) {
    return t.totalListenMs + (t.listenStartedAt ? Date.now() - t.listenStartedAt : 0);
  }
};
