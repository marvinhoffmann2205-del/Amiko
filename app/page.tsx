"use client";
import { useState } from "react";
import { TUTORS, TutorProfile } from "@/lib/tutors";
import { Level } from "@/lib/amivoEngine";
import TutorSelectScreen from "@/components/TutorSelectScreen";
import LevelSelectScreen from "@/components/LevelSelectScreen";
import ChatScreen from "@/components/ChatScreen";

type Step = "tutor" | "level" | "chat";

export default function Home() {
  const [step, setStep] = useState<Step>("tutor");
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [level, setLevel] = useState<Level | null>(null);

  return (
    <div className="stage">
      {step === "tutor" && (
        <TutorSelectScreen onPick={(id) => { setTutor(TUTORS[id]); setStep("level"); }} />
      )}
      {step === "level" && tutor && (
        <LevelSelectScreen tutor={tutor} onStart={(lvl) => { setLevel(lvl); setStep("chat"); }} />
      )}
      {step === "chat" && tutor && level && (
        <ChatScreen tutor={tutor} level={level} />
      )}
    </div>
  );
}
