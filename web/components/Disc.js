"use client";
// A vinyl record with the waveform M on its red label: the studio's "mastered" mark.
// Tilt the <svg> from outside; add the class `spinning` to turn the record itself.
import { useId } from "react";

export default function Disc({ className = "", size = 120, label = "MEETLY · ON THE RECORD · MEETLY · ON THE RECORD · " }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className={`disc ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <path id={`dt${id}`} d="M60 60 m-47 0 a47 47 0 1 1 94 0 a47 47 0 1 1 -94 0" />
        <radialGradient id={`dl${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ff5a4e" />
          <stop offset="1" stopColor="#c81e12" />
        </radialGradient>
      </defs>
      <g className="disc-spin">
        <circle cx="60" cy="60" r="58" fill="#0d0d0d" />
        <circle cx="60" cy="60" r="57.5" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        {[52, 48, 44, 40, 36, 32, 28].map(r => <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth=".8" />)}
        <text fontSize="5.2" letterSpacing="1.6" fill="rgba(245,245,240,.42)" fontFamily="JetBrains Mono, monospace" fontWeight="700">
          <textPath href={`#dt${id}`}>{label}</textPath>
        </text>
        <circle cx="60" cy="60" r="22" fill={`url(#dl${id})`} />
        <g transform="translate(46 45) scale(.44)" fill="#f5f5f0">
          {[[10, 10, 54], [21, 10, 32], [32, 10, 42], [43, 10, 32], [54, 10, 54]].map(([x, y1, y2], i) => (
            <rect key={i} x={x - 3.5} y={y1} width="7" height={y2 - y1} rx="3.5" opacity={i === 2 ? 1 : 0.92} />
          ))}
        </g>
        <circle cx="60" cy="60" r="1.8" fill="#0a0a0a" />
      </g>
      {/* the light on the vinyl stays put while the record turns */}
      <path d="M60 4 A56 56 0 0 1 108 32 L60 60 Z" fill="rgba(255,255,255,.05)" />
      <path d="M60 116 A56 56 0 0 1 12 88 L60 60 Z" fill="rgba(255,255,255,.035)" />
    </svg>
  );
}
