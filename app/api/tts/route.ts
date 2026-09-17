// app/api/tts/route.ts
//
// This is the ONLY file that references CARTESIA_API_KEY. The browser
// never talks to Cartesia directly — it POSTs { text, tutorId } here,
// and gets back playable audio bytes. The real key never leaves the
// server, matching the pattern used for Deepgram's stt-token route.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CARTESIA_VERSION = "2024-11-13"; // pin a known-working version; bump deliberately, not silently

// Per-tutor voice IDs live in env vars, not source — so swapping a
// voice never requires a code change or redeploy of application logic.
// Add one new env var per tutor as they go live (e.g. CARTESIA_VOICE_ID_MATEO).
const VOICE_ENV_BY_TUTOR: Record<string, string | undefined> = {
  cami: process.env.CARTESIA_VOICE_ID_CAMI
};

export async function POST(req: Request) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    console.error("[tts] Missing CARTESIA_API_KEY env var.");
    return NextResponse.json({ error: "tts_not_configured" }, { status: 500 });
  }

  let body: { text?: string; tutorId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request_body" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  const tutorId = body.tutorId || "cami";
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "text_too_long" }, { status: 400 });

  const voiceId = VOICE_ENV_BY_TUTOR[tutorId];
  if (!voiceId) {
    console.error(`[tts] No voice configured for tutorId "${tutorId}". Set CARTESIA_VOICE_ID_${tutorId.toUpperCase()}.`);
    return NextResponse.json({ error: "voice_not_configured" }, { status: 500 });
  }

  try {
    const cartesiaRes = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": CARTESIA_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: "sonic-3.5",
        transcript: text,
        voice: { mode: "id", id: voiceId },
        // Spanish by default since Cami mostly speaks Spanish; the
        // model still renders mixed-language help sentences intelligibly.
        // Swap per-message if/when the engine tags a reply's dominant language.
        language: "es",
        output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 }
      })
    });

    if (!cartesiaRes.ok) {
      const errText = await cartesiaRes.text();
      console.error("[tts] Cartesia request failed:", cartesiaRes.status, errText);
      return NextResponse.json({ error: "tts_provider_error" }, { status: 502 });
    }

    const audioBuffer = await cartesiaRes.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": cartesiaRes.headers.get("content-type") || "audio/wav",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("[tts] Unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
