"use client";
import { TutorProfile } from "@/lib/tutors";

export default function TutorPortrait({ tutor, state = "welcome" }: { tutor: TutorProfile; state?: string }) {
  const v = tutor.visual;
  const id = tutor.id;
  return (
    <svg viewBox="0 0 400 480" role="img" aria-label={`Portrait of ${tutor.name}`} data-state={state} className="portrait-svg">
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={v.bgFrom} /><stop offset="100%" stopColor={v.bgTo} />
        </linearGradient>
        <linearGradient id={`skin-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={v.skinFrom} /><stop offset="100%" stopColor={v.skinTo} />
        </linearGradient>
        <linearGradient id={`hair-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={v.hairFrom} /><stop offset="100%" stopColor={v.hairTo} />
        </linearGradient>
        <linearGradient id={`top-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={v.topFrom} /><stop offset="100%" stopColor={v.topTo} />
        </linearGradient>
        <radialGradient id={`glow-${id}`}>
          <stop offset="0%" stopColor={v.glow} stopOpacity="0.55" /><stop offset="100%" stopColor={v.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M40,462 V202 A160,160 0 0 1 360,202 V462 Z" fill={`url(#bg-${id})`} />
      <circle cx="205" cy="195" r="150" fill={`url(#glow-${id})`} />
      <path d="M120,178 C108,116 150,64 200,62 C250,64 293,116 281,178 C302,222 300,306 284,384 C274,424 258,444 248,458 L152,458 C142,444 126,424 116,384 C100,306 98,222 120,178 Z" fill={`url(#hair-${id})`} />
      <path d="M132,478 C134,382 152,336 200,331 C248,336 267,382 269,478 Z" fill={`url(#top-${id})`} />
      <rect x="182" y="286" width="37" height="58" rx="16" fill={`url(#skin-${id})`} />
      <ellipse cx="200.5" cy="212" rx="80" ry="94" fill={`url(#skin-${id})`} />
      <circle cx="122" cy="234" r="5" fill={v.accent} /><circle cx="279" cy="234" r="5" fill={v.accent} />
      <path d="M138,152 Q160,118 192,136 Q209,108 231,136 Q262,118 264,152 L258,178 Q230,150 200,169 Q170,150 144,178 Z" fill={`url(#hair-${id})`} />
      <path d="M167,196 Q179,187 193,195" stroke={v.brow} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M208,195 Q222,187 234,196" stroke={v.brow} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <ellipse cx="179" cy="211" rx="10" ry="7" fill="#FFFFFF" /><circle cx="181" cy="211" r="4.4" fill={v.eye} /><circle cx="182.6" cy="209.3" r="1.3" fill="#FFF" />
      <ellipse cx="222" cy="211" rx="10" ry="7" fill="#FFFFFF" /><circle cx="220" cy="211" r="4.4" fill={v.eye} /><circle cx="221.6" cy="209.3" r="1.3" fill="#FFF" />
      <ellipse cx="172" cy="234" rx="14" ry="8" fill={v.blush} opacity="0.4" /><ellipse cx="230" cy="234" rx="14" ry="8" fill={v.blush} opacity="0.4" />
      <path d="M200,208 L197,230 Q200,234 204,230" stroke={v.skinTo} strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />
      <path d="M177,251 Q200,268 223,251 Q200,263 177,251 Z" fill={v.mouth} />
      <g className="g-listen"><ellipse className="ring-anim" cx="200" cy="235" rx="188" ry="222" fill="none" stroke={v.accent} strokeWidth="2.5" strokeDasharray="6 10" /></g>
      <g className="g-speak" transform="translate(186,300)">
        <rect className="wave-bar" x="0" y="-4" width="5" height="14" rx="2.5" fill={v.accent} />
        <rect className="wave-bar" x="9" y="-8" width="5" height="22" rx="2.5" fill={v.accent} />
        <rect className="wave-bar" x="18" y="-5" width="5" height="16" rx="2.5" fill={v.accent} />
        <rect className="wave-bar" x="27" y="-9" width="5" height="24" rx="2.5" fill={v.accent} />
      </g>
      <g className="g-think" transform="translate(300,120)">
        <circle className="think-dot" cx="0" cy="0" r="5" fill={v.gold} />
        <circle className="think-dot" cx="16" cy="-8" r="5" fill={v.gold} />
        <circle className="think-dot" cx="32" cy="-18" r="5" fill={v.gold} />
      </g>
    </svg>
  );
}
