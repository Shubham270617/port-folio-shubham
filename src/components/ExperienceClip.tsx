"use client";

/* A short looping animated clip for each role, drawn in SVG and animated with CSS, so it plays
   like a video without downloading one. Tap the clip to pause or play.
   To use real footage instead, set `video: "/clips/qss.mp4"` on the job in src/data/portfolio.ts. */

import { useState } from "react";
import type { Job } from "@/data/portfolio";

const INK = "#2B2140", PAPER = "#FFF8EE", GLOW = "#FFC93C", ACCENT = "#FF5A3C", SEA = "#8FE3E0", LEAF = "#7BC96F";

/* QSS Technosoft: a LangGraph agent passing work between steps, plus the StarPro budget chart */
function Agents() {
  const nodes: [number, number, string][] = [[46, 44, "Plan"], [124, 84, "Stand-up"], [204, 44, "Groom"], [278, 84, "Blockers"]];
  return (
    <>
      <path d="M46 44 L124 84 L204 44 L278 84" fill="none" stroke={SEA} strokeWidth="2" strokeDasharray="5 5" className="cl-dash" />
      {nodes.map(([x, y, t], i) => (
        <g key={t} className="cl-node" style={{ animationDelay: `${i * 0.9}s` }}>
          <circle cx={x} cy={y} r="17" fill={i === 3 ? ACCENT : PAPER} stroke={GLOW} strokeWidth="2.5" />
          <text x={x} y={y + 31} textAnchor="middle" fill={PAPER} fontSize="9.5">{t}</text>
        </g>
      ))}
      <circle r="6" fill={GLOW} className="cl-travel" style={{ offsetPath: "path('M46 44 L124 84 L204 44 L278 84')" }} />
      <g transform="translate(18 104)">
        {[14, 24, 18, 30, 22].map((h, i) => (
          <rect key={i} x={i * 11} y={34 - h} width="8" height={h} rx="2" fill={i === 3 ? GLOW : SEA} className="cl-bar" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
        <text x="62" y="30" fill={PAPER} fontSize="9.5">StarPro · budget vs variance</text>
      </g>
    </>
  );
}

/* NeoSoft / DotPe: cart events queue up offline on the POS, then flush to the server */
function Pos() {
  return (
    <>
      <rect x="18" y="22" width="112" height="100" rx="10" fill={PAPER} stroke={GLOW} strokeWidth="2.5" />
      <text x="30" y="40" fill={INK} fontSize="9.5">Rista POS · cart audit</text>
      {["Created", "Order placed", "Session ended"].map((t, i) => (
        <g key={t} className="cl-row" style={{ animationDelay: `${i * 0.8}s` }}>
          <rect x="28" y={50 + i * 22} width="92" height="16" rx="5" fill={i === 1 ? LEAF : SEA} stroke={INK} strokeWidth="1.5" />
          <text x="34" y={61.5 + i * 22} fill={INK} fontSize="9">{t}</text>
        </g>
      ))}
      <path d="M136 72 H236" stroke={SEA} strokeWidth="2" strokeDasharray="5 5" className="cl-dash" />
      {[0, 1, 2].map(i => (
        <circle key={i} r="5" fill={GLOW} className="cl-travel" style={{ offsetPath: "path('M136 72 H236')", animationDelay: `${i * 0.9}s`, animationDuration: "2.7s" }} />
      ))}
      <g className="cl-pulse">
        <ellipse cx="270" cy="50" rx="30" ry="9" fill={GLOW} stroke={INK} strokeWidth="2" />
        <path d="M240 50 V94 A30 9 0 0 0 300 94 V50" fill={PAPER} stroke={INK} strokeWidth="2" />
        <path d="M240 72 A30 9 0 0 0 300 72" fill="none" stroke={INK} strokeWidth="2" />
      </g>
      <text x="186" y="60" textAnchor="middle" fill={PAPER} fontSize="9.5">bulk flush</text>
      <text x="186" y="94" textAnchor="middle" fill={SEA} fontSize="9.5">offline-first</text>
      <text x="270" y="124" textAnchor="middle" fill={PAPER} fontSize="9.5">no duplicates</text>
    </>
  );
}

/* RWS Group: four internal tools shipped end to end, backed by 15+ APIs */
function Tools() {
  const tiles = ["UB Keep", "UB Password", "UB Mail", "UB Drive"], fills = [GLOW, SEA, ACCENT, LEAF];
  return (
    <>
      {tiles.map((t, i) => {
        const x = 20 + (i % 2) * 92, y = 18 + Math.floor(i / 2) * 58;
        return (
          <g key={t} className="cl-tile" style={{ animationDelay: `${i * 0.5}s` }}>
            <rect x={x} y={y} width="84" height="48" rx="9" fill={PAPER} stroke={fills[i]} strokeWidth="3" />
            <rect x={x + 10} y={y + 10} width="18" height="18" rx="5" fill={fills[i]} stroke={INK} strokeWidth="1.5" />
            <text x={x + 10} y={y + 40} fill={INK} fontSize="9">{t}</text>
          </g>
        );
      })}
      <g className="cl-pulse">
        <circle cx="262" cy="62" r="36" fill="none" stroke={SEA} strokeWidth="2" strokeDasharray="4 6" className="cl-spin" style={{ transformOrigin: "262px 62px" }} />
        <circle cx="262" cy="62" r="26" fill={GLOW} stroke={INK} strokeWidth="2" />
        <text x="262" y="60" textAnchor="middle" fill={INK} fontSize="15" fontWeight="700">15+</text>
        <text x="262" y="72" textAnchor="middle" fill={INK} fontSize="8.5">REST APIs</text>
      </g>
      <text x="262" y="122" textAnchor="middle" fill={PAPER} fontSize="9.5">JWT · role-based access</text>
    </>
  );
}

/* Magneto: pharmacy apps on phones, and two YES Awards */
function Health() {
  return (
    <>
      <rect x="28" y="12" width="78" height="126" rx="12" fill={PAPER} stroke={GLOW} strokeWidth="2.5" />
      <path d="M61 26h12v10h10v12H73v10H61V48H51V36h10z" fill={ACCENT} stroke={INK} strokeWidth="1.5" className="cl-beat" style={{ transformOrigin: "67px 42px" }} />
      {[0, 1, 2].map(i => (
        <g key={i} className="cl-row" style={{ animationDelay: `${i * 0.7}s` }}>
          <rect x="38" y={70 + i * 20} width="58" height="14" rx="5" fill={i === 2 ? LEAF : SEA} stroke={INK} strokeWidth="1.5" />
        </g>
      ))}
      {[[140, 104], [170, 60], [200, 112]].map(([x, y], i) => (
        <g key={i} className="cl-float" style={{ animationDelay: `${i * 0.6}s` }}>
          <rect x={x} y={y} width="26" height="12" rx="6" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          <rect x={x} y={y} width="13" height="12" rx="6" fill={i === 1 ? GLOW : ACCENT} stroke={INK} strokeWidth="1.5" />
        </g>
      ))}
      <g className="cl-bounce" style={{ transformOrigin: "268px 60px" }}>
        <path d="M268 28 l9 19 21 3 -15 15 4 21 -19 -10 -19 10 4 -21 -15 -15 21 -3z" fill={GLOW} stroke={PAPER} strokeWidth="2" strokeLinejoin="round" />
        <text x="268" y="68" textAnchor="middle" fill={INK} fontSize="13" fontWeight="700">×2</text>
      </g>
      <text x="268" y="112" textAnchor="middle" fill={PAPER} fontSize="9.5">YES Awards</text>
      <text x="268" y="126" textAnchor="middle" fill={SEA} fontSize="9.5">3 of 3 clients happy</text>
    </>
  );
}

/* Internship: an automated reviewer checks code line by line */
function Review() {
  return (
    <>
      <rect x="18" y="16" width="176" height="118" rx="10" fill={PAPER} stroke={GLOW} strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i}>
          <rect x="52" y={30 + i * 20} width={[104, 78, 118, 64, 92][i]} height="8" rx="4" fill={INK} opacity=".35" />
          <circle cx="36" cy={34 + i * 20} r="7" fill={ACCENT} stroke={INK} strokeWidth="1.5" />
          <g className="cl-check" style={{ animationDelay: `${i * 0.7}s` }}>
            <circle cx="36" cy={34 + i * 20} r="7" fill={LEAF} stroke={INK} strokeWidth="1.5" />
            <path d={`M32.5 ${34 + i * 20} l2.5 2.8 4.5 -5.2`} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      ))}
      <rect x="22" y="20" width="168" height="4" rx="2" fill={SEA} opacity=".9" className="cl-scan" />
      <g className="cl-pulse">
        <text x="258" y="58" textAnchor="middle" fill={GLOW} fontSize="26" fontWeight="700">30%</text>
        <text x="258" y="74" textAnchor="middle" fill={PAPER} fontSize="9.5">faster reviews</text>
      </g>
      <text x="258" y="106" textAnchor="middle" fill={SEA} fontSize="18" fontWeight="700">15%</text>
      <text x="258" y="120" textAnchor="middle" fill={PAPER} fontSize="9.5">fewer defects</text>
    </>
  );
}

const SCENES = { agents: Agents, pos: Pos, tools: Tools, health: Health, review: Review } as const;

export default function ExperienceClip({ job }: { job: Job }) {
  const [paused, setPaused] = useState(false);
  const Scene = job.clip ? SCENES[job.clip] : null;
  if (!job.video && !Scene) return null;

  if (job.video) {
    return (
      <figure className="clip">
        <video src={job.video} autoPlay muted loop playsInline controls preload="metadata" aria-label={`Clip from ${job.company}`} />
      </figure>
    );
  }
  return (
    <figure className={paused ? "clip paused" : "clip"}>
      <button
        type="button" className="clip-stage" aria-pressed={paused}
        aria-label={`${paused ? "Play" : "Pause"} the animated clip for ${job.company}`}
        onClick={() => setPaused(p => !p)}
      >
        <svg viewBox="0 0 320 172" role="img" aria-label={`Animated illustration of the work at ${job.company}`}>
          {Scene && <Scene />}
        </svg>
        <span className="clip-bar" aria-hidden="true">
          <i className="clip-icon" />
          <span className="clip-track"><i /></span>
          <span className="clip-tag">animated</span>
        </span>
      </button>
    </figure>
  );
}
