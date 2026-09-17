# AMIVO — Web (Phase 2: real Deepgram streaming STT)

This is the real, deployable AMIVO project — the artifact prototype
(kept separately as a reference) has been migrated here so a real
backend can hold API keys securely.

## Current milestone (and ONLY this milestone)

iPhone Safari → this deployed HTTPS app → real microphone → Deepgram
streaming STT → accurate live Spanish transcript inside the chat.

No real LLM, no TTS, no Learn/Progress/payments yet — those come after
this milestone is confirmed working on a real phone.

## Structure

```
app/
  api/stt-token/route.ts   ← the ONLY file that touches DEEPGRAM_API_KEY
  layout.tsx, page.tsx, globals.css
components/
  TutorPortrait.tsx        ← ported SVG portrait renderer
  TutorSelectScreen.tsx
  LevelSelectScreen.tsx
  ChatScreen.tsx            ← mic + text chat, wired to AmivoEngine
lib/
  tutors.ts                 ← TutorProfile data (Cami live, Mateo coming soon)
  amivoEngine.ts             ← ported rule-based reactTo() — untouched logic
  sttProviders.ts            ← SttProvider interface + WebSpeech fallback + real Deepgram
  useMic.ts                  ← React hook wrapping the provider lifecycle
  sttTelemetry.ts             ← usage/cost telemetry, provider-agnostic
  ttsProvider.ts              ← interface only — NOT implemented (Phase 3B)
  learnerSession.ts           ← in-memory session shape — NOT persisted (Phase 6/7)
  controls.ts                 ← Explain/Slower/Repeat/Translate quick actions
```

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in real values locally.
In Vercel, set the same two under Project Settings → Environment Variables.
Never commit `.env.local` — it's already in `.gitignore`.

```
DEEPGRAM_API_KEY=...
DEEPGRAM_PROJECT_ID=...
```

Deployment steps are covered separately, step by step.
