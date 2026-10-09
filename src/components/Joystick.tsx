"use client";

import { useRef, type PointerEvent } from "react";

/** On-screen joystick for touch devices. Reports x/y in the range -1 to 1. */
export default function Joystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  const move = (e: PointerEvent) => {
    if (!base.current || !knob.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy), max = 40;
    if (m > max) { dx = (dx / m) * max; dy = (dy / m) * max; }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove(dx / max, dy / max);
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    if (knob.current) knob.current.style.transform = "";
    onMove(0, 0);
  };

  return (
    <div
      className="stick sticker" ref={base} aria-hidden="true"
      onPointerDown={e => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={e => { if (e.pointerId === active.current) move(e); }}
      onPointerUp={end} onPointerCancel={end}
    >
      <div className="knob" ref={knob} />
    </div>
  );
}
