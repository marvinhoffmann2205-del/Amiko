# AMIVO — Web (Phase 2: real Deepgram streaming STT)

This is the real, deployable AMIVO project — the artifact prototype
(kept separately as a reference) has been migrated here so a real
backend can hold API keys securely.

## Current milestone (and ONLY this milestone)

iPhone Safari → this deployed HTTPS app → real microphone → Deepgram
streaming STT → accurate live Spanish transcript inside the chat.
Cami now also speaks her greeting and every reply aloud via Cartesia
(Phase 3B), with playback interruptible for future barge-in.

No real LLM, avatar, Learn/Progress/payments yet — Phase 3A (swapping
the rule-based reactTo() for a real Anthropic call) is still pending;
Cami's spoken lines are whatever that rule-based engine currently produces.

## Structure

```
app/
  api/stt-token/route.ts   ← the ONLY file that touches DEEPGRAM_API_KEY
  api/tts/route.ts          ← the ONLY file that touches CARTESIA_API_KEY
  layout.tsx, page.tsx, globals.css
components/
  TutorPortrait.tsx        ← ported SVG portrait renderer
  TutorSelectScreen.tsx
  LevelSelectScreen.tsx     ← also "unlocks" audio autoplay on the Start button (iOS)
  ChatScreen.tsx            ← mic + text chat + auto-spoken replies
lib/
  tutors.ts                 ← TutorProfile data (Cami live, Mateo coming soon)
  amivoEngine.ts             ← ported rule-based reactTo() — untouched logic
  sttProviders.ts            ← SttProvider interface + WebSpeech fallback + real Deepgram
  useMic.ts                  ← React hook wrapping the STT provider lifecycle
  sttTelemetry.ts             ← usage/cost telemetry, provider-agnostic
  ttsProvider.ts              ← TtsProvider interface + real Cartesia implementation
  learnerSession.ts           ← in-memory session shape — NOT persisted (Phase 6/7)
  controls.ts                 ← Explain/Slower/Repeat/Translate quick actions
```

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in real values locally.
In Vercel, set the same under Project Settings → Environment Variables.
Never commit `.env.local` — it's already in `.gitignore`.

```
DEEPGRAM_API_KEY=...
DEEPGRAM_PROJECT_ID=...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID_CAMI=...
```

## Known iOS/Safari caveat for TTS

Safari blocks audio autoplay unless it was "unlocked" by a real user tap.
`LevelSelectScreen`'s "Start Talking" button does this automatically —
if Cami's greeting still doesn't play out loud on iPhone, the in-app
notice under the composer will say why (autoplay blocked vs. voice not
configured vs. a network error), rather than failing silently.

Deployment steps are covered separately, step by step.

