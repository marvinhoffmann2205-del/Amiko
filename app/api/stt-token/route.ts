import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error("[stt-token] Missing DEEPGRAM_API_KEY");
    return NextResponse.json(
      { error: "stt_not_configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token: apiKey,
  });
}