"use client";
import { useState } from "react";
import { TutorProfile } from "@/lib/tutors";
import { Level } from "@/lib/amivoEngine";
import { pickTtsProvider } from "@/lib/ttsProvider";
import TutorPortrait from "./TutorPortrait";

const LEVELS: { level: Level; title: string; desc: string }[] = [
  { level: "Beginner", title: "Beginner", desc: "I know little or no Spanish." },
  { level: "Intermediate", title: "Intermediate", desc: "I can have basic conversations." },
  { level: "Advanced", title: "Advanced", desc: "I speak comfortably and want to improve." }
];

export default function LevelSelectScreen({ tutor, onStart }: { tutor: TutorProfile; onStart: (level: Level) => void }) {
  const [selected, setSelected] = useState<Level | null>(null);

  function handleStart() {
    if (!selected) return;
    // Must happen synchronously inside this click handler, or iOS Safari
    // will silently block Cami's very first spoken greeting on the next screen.
    pickTtsProvider().unlock?.();
    onStart(selected);
  }

  return (
    <div className="screen-body level-screen">
      <div>
        <div className="level-anchor">
          <div className="portrait-wrap sm"><TutorPortrait tutor={tutor} /></div>
          <div><p className="eyebrow">One quick thing</p><p>So {tutor.name} knows where to start.</p></div>
        </div>
        <h2>How's your Spanish?</h2>
        {LEVELS.map(({ level, title, desc }) => (
          <button
            key={level}
            className={"level-option" + (selected === level ? " selected" : "")}
            onClick={() => setSelected(level)}
          >
            <div className="lvl-title">{title}</div>
            <div className="lvl-desc">{desc}</div>
          </button>
        ))}
      </div>
      <div className="ob-foot">
        <button className="btn btn-primary btn-block" disabled={!selected} onClick={handleStart}>
          Start Talking
        </button>
      </div>
    </div>
  );
}
