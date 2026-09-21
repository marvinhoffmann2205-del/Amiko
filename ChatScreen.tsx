"use client";
import { useEffect, useRef, useState } from "react";
import { TutorProfile } from "@/lib/tutors";
import { AmivoEngine, Level, Session } from "@/lib/amivoEngine";
import { controlAction } from "@/lib/controls";
import { useMic } from "@/lib/useMic";
import { SttTelemetryOps } from "@/lib/sttTelemetry";
import TutorPortrait from "./TutorPortrait";

type Msg = { from: "user" | "cami"; text: string; tag?: string };

export default function ChatScreen({ tutor, level }: { tutor: TutorProfile; level: Level }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Online");
  const [portraitState, setPortraitState] = useState("welcome");
  const [showTelemetry, setShowTelemetry] = useState(false);
  const sessionRef = useRef<Session>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef("");

  function appendCami(text: string, tag?: string) {
    setMessages(m => [...m, { from: "cami", text, tag }]);
  }

  async function respond(userText: string) {
    setMessages(m => [...m, { from: "user", text: userText }]);
    setStatus("Thinking…"); setPortraitState("thinking");
   try {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: userText,
      level: level,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Chat API error:", data);
    setStatus("Something went wrong");
    return;
  }

  const reply = data.reply;

  setPortraitState("speaking");
  setStatus(`${tutor.name} is speaking…`);
  appendCami(reply);

  setTimeout(() => {
    setPortraitState("welcome");
    setStatus("Online");
  }, 1200);

} catch (error) {
  console.error("Cami response error:", error);
  setStatus("Connection error");
}
  }

const mic = useMic((finalText) => {
  pendingTextRef.current = pendingTextRef.current
    ? `${pendingTextRef.current} ${finalText}`
    : finalText;

  if (turnTimerRef.current) {
    clearTimeout(turnTimerRef.current);
  }

  turnTimerRef.current = setTimeout(() => {
    const text = pendingTextRef.current.trim();
    pendingTextRef.current = "";

    if (text) {
      respond(text);
    }
  }, 700);
});

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    appendCami(AmivoEngine.opening(tutor, level));
  }, [tutor, level]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    setPortraitState(mic.state === "listening" ? "listening" : portraitState);
  }, [mic.state]); // eslint-disable-line react-hooks/exhaustive-deps

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    respond(text);
  }

  function lastCamiText(): string | null {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === "cami") return messages[i].text;
    return null;
  }

  function runControl(kind: string) {
    const text = controlAction(kind, level, sessionRef.current, lastCamiText());
    appendCami(text, kind.toUpperCase());
  }

  return (
    <div className="screen-body chat-screen">
      <header className="app-header">
        <div className="portrait-wrap header-portrait"><TutorPortrait tutor={tutor} state={portraitState} /></div>
        <div className="titles">
          <h1>{tutor.name} · {tutor.city}</h1>
          <p>{status}</p>
        </div>
        <button className="icon-flat" onClick={() => setShowTelemetry(s => !s)} aria-label="STT telemetry">📊</button>
      </header>

      {showTelemetry && (
        <div className="telemetry-panel">
          <div className="t-row"><span>STT provider</span><span>{mic.providerName}</span></div>
          <div className="t-row"><span>Mic time this session</span><span>{Math.floor(SttTelemetryOps.liveMs(mic.telemetry) / 1000)}s</span></div>
          <div className="t-row"><span>Final transcripts</span><span>{mic.telemetry.finalCount}</span></div>
          <div className="t-row"><span>Characters transcribed</span><span>{mic.telemetry.totalChars}</span></div>
          <div className="t-row"><span>Estimated STT cost</span><span>${SttTelemetryOps.estimateCost(mic.telemetry).toFixed(4)}</span></div>
          {mic.lastError && <div className="t-row"><span>Last mic error</span><span>{mic.lastError}</span></div>}
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`msg-row from-${m.from}`}>
            {m.from === "cami" && <div className="msg-av"><TutorPortrait tutor={tutor} /></div>}
            <div className="bubble">
              {m.tag && <span className="tag">{m.tag}</span>}
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {mic.level > 0 && (
        <div className="level-meter"><div className="level-meter-fill" style={{ width: `${mic.level * 100}%` }} /></div>
      )}
      {mic.partial && <div className="partial-row">{mic.partial}</div>}

      <div className="control-row">
        <button className="ctrl-btn" onClick={() => runControl("explain")}>💡 Explain</button>
        <button className="ctrl-btn" onClick={() => runControl("slower")}>🐢 Slower</button>
        <button className="ctrl-btn" onClick={() => runControl("repeat")}>🔁 Repeat</button>
        <button className="ctrl-btn" onClick={() => runControl("translate")}>🌐 Translate</button>
      </div>

      <div className="voice-note">
        {mic.supported ? "Tap the mic and speak, or type below." : "Voice input isn't supported in this browser — type your message below."}
      </div>

      <div className="composer">
        <button
          className={"icon-btn mic" + (mic.state === "listening" ? " listening" : "") + (!mic.supported ? " unsupported" : "")}
          onClick={() => (mic.state === "listening" ? mic.stop() : mic.start())}
          aria-label="Voice input"
        >
          <span className="mic-ring" />🎙️
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder="Escribe algo… or type in English"
        />
        <button className="icon-btn send" onClick={send} aria-label="Send">➤</button>
      </div>
    </div>
  );
}
