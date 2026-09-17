// app/api/stt-token/route.ts
//
// This is the ONLY file in the whole project allowed to reference
// DEEPGRAM_API_KEY. It runs on Vercel's server, never in the browser.
// The browser calls GET /api/stt-token and receives a scoped,
// 60-second Deepgram key — never the real one.

import { NextResponse } from "next/server";

export const runtime = "nodejs"; // needs standard fetch + env access; fine on Vercel

const TOKEN_TTL_SECONDS = 60;

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const projectId = process.env.DEEPGRAM_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error("[stt-token] Missing DEEPGRAM_API_KEY or DEEPGRAM_PROJECT_ID env vars.");
    return NextResponse.json({ error: "stt_not_configured" }, { status: 500 });
  }

  try {
    const dgRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        comment: "amivo-stt-session",
        scopes: ["usage:write"],
        time_to_live_in_seconds: TOKEN_TTL_SECONDS
      })
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      console.error("[stt-token] Deepgram key mint failed:", dgRes.status, errText);
      return NextResponse.json({ error: "stt_provider_unavailable" }, { status: 502 });
    }

    const dgKey = await dgRes.json();
    return NextResponse.json({
      token: dgKey.key,
      expiresInSeconds: TOKEN_TTL_SECONDS,
      mintedAt: Date.now()
    });
  } catch (err) {
    console.error("[stt-token] Unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
