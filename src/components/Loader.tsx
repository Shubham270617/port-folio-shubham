"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

interface Props {
  name: string;
  title: string;
  /** Real build progress of the 3D world, 0 to 1. */
  progress: number;
  ready: boolean;
  leaving: boolean;
  onStart: () => void;
  onSimple: () => void;
  onGone: () => void;
}

// The sheet of paper and the boat it folds into, as matching 7-point polygons (percent).
const SHEET = [[20, 12], [35, 12], [50, 12], [65, 12], [80, 12], [80, 87], [20, 87]];
const BOAT = [[0, 52], [30, 52], [50, 4], [70, 52], [100, 52], [78, 96], [22, 96]];

export default function Loader({ name, title, progress, ready, leaving, onStart, onSimple, onGone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLParagraphElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const startBtn = useRef<HTMLButtonElement>(null);
  const shown = useRef({ v: 0 });
  const [folded, setFolded] = useState(false);

  // The fold follows loading progress: 0% is a flat sheet, 100% is the finished boat.
  useEffect(() => {
    const draw = () => {
      const p = shown.current.v;
      const pts = SHEET.map(([x, y], i) => `${x + (BOAT[i][0] - x) * p}% ${y + (BOAT[i][1] - y) * p}%`).join(", ");
      if (paper.current) {
        paper.current.style.clipPath = `polygon(${pts})`;
        paper.current.style.transform = `rotate(${Math.sin(p * Math.PI) * -8}deg)`;
      }
      if (fill.current) fill.current.style.transform = `scaleX(${p})`;
      if (num.current) num.current.textContent = `${Math.round(p * 100)}%`;
      bar.current?.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    };
    draw();
    const t = gsap.to(shown.current, {
      v: progress, duration: 0.55, ease: "power1.out", onUpdate: draw,
      onComplete: () => { if (progress >= 0.999) setFolded(true); }
    });
    return () => { t.kill(); };
  }, [progress]);

  const canStart = ready && folded;
  useEffect(() => {
    if (!canStart || !startBtn.current) return;
    gsap.fromTo(startBtn.current, { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: "back.out(2.4)" });
    startBtn.current.focus({ preventScroll: true });
  }, [canStart]);

  useEffect(() => {
    if (!leaving || !root.current) return;
    const t = gsap.to(root.current, { autoAlpha: 0, duration: 0.7, ease: "power2.inOut", onComplete: onGone });
    return () => { t.kill(); };
  }, [leaving, onGone]);

  return (
    <div className="loader" ref={root}>
      <div className="loader-inner">
        <div className="fold" aria-hidden="true">
          <div className="paper" ref={paper} />
          <div className="fold-sea" />
        </div>
        <h1>{name}</h1>
        <p className="loader-role">{title}</p>
        <p className="loader-lead">
          {canStart ? "Sail a paper boat between five islands to explore my work." : "Folding your paper boat…"}
        </p>
        <div className="progress" role="progressbar" aria-label="Loading the 3D world" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} ref={bar}>
          <div className="progress-fill" ref={fill} />
        </div>
        <p className="progress-num" ref={num}>0%</p>
        <div className="loader-actions">
          {canStart && <button className="btn primary lg" type="button" ref={startBtn} onClick={onStart}>Start sailing</button>}
          <button className="btn" type="button" onClick={onSimple}>Simple view</button>
        </div>
      </div>
    </div>
  );
}
