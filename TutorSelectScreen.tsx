"use client";
import { TUTORS } from "@/lib/tutors";
import TutorPortrait from "./TutorPortrait";

export default function TutorSelectScreen({ onPick }: { onPick: (tutorId: string) => void }) {
  return (
    <div className="screen-body">
      <div className="topbar"><span className="wordmark"><span className="dot" />AMIVO</span></div>
      <div className="picker-body">
        <h1>Choose your tutor</h1>
        <p className="lede">A few seconds from now, you'll be talking.</p>

        <div className="tutor-card">
          <div className="portrait-wrap sm"><TutorPortrait tutor={TUTORS.cami} /></div>
          <div className="info">
            <div className="name">Cami 🇨🇴</div>
            <div className="city">Medellín</div>
            <div className="tags">Warm · Playful · Patient</div>
          </div>
          <button className="btn btn-primary" onClick={() => onPick("cami")}>Talk with Cami</button>
        </div>

        <div className="tutor-card locked">
          <div className="portrait-wrap sm"><TutorPortrait tutor={TUTORS.mateo} /></div>
          <div className="info">
            <div className="name">Mateo 🇨🇴</div>
            <div className="city">Bogotá</div>
            <div className="tags">Relaxed · Witty · Encouraging</div>
          </div>
          <span className="soon-badge">COMING SOON</span>
        </div>
      </div>
    </div>
  );
}
