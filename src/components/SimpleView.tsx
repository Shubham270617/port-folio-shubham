"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import gsap from "gsap";
import type { Portfolio } from "@/data/portfolio";
import { Background, ContactBlock, LinkBtn, ProjectCard, ResumeBtn, Services, Skills, Stats, ThemeToggle, Timeline } from "./sections";

interface Props {
  data: Portfolio;
  open: boolean;
  reduceMotion: boolean;
  night: boolean;
  onToggleNight: () => void;
  /** null when the 3D world is unavailable (WebGL failed), so there is nothing to go back to. */
  onBack: (() => void) | null;
  onCopy: () => void;
}

const NAV = [
  { id: "s-about", label: "About" },
  { id: "s-experience", label: "Experience" },
  { id: "s-projects", label: "Projects" },
  { id: "s-skills", label: "Skills" },
  { id: "s-contact", label: "Contact" }
];

// One long strip of identical wave crests; CSS slides it sideways by exactly one crest, forever.
const WAVE = `M0 22${" q 50 -18 100 0 t 100 0".repeat(16)} V 60 H 0 Z`;
const STARS = Array.from({ length: 22 }, (_, i) => ({ left: (i * 37 + 11) % 100, top: (i * 53 + 7) % 62, delay: (i % 7) * 0.45 }));

const BoatSvg = () => (
  <svg viewBox="0 0 40 40">
    <path d="M3 22h11l6-16 6 16h11l-6 11H9z" fill="#FFF8EE" stroke="#2B2140" strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M14 22h12" stroke="#FF5A3C" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** The animated strip at the top (and bottom) of the page: sky, sun or moon, clouds, waves and a sailing boat. */
function Scene({ foot = false }: { foot?: boolean }) {
  return (
    <div className={foot ? "s-scene foot" : "s-scene"} aria-hidden="true">
      {!foot && (
        <>
          <div className="sc-stars">{STARS.map((s, i) => <i key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }} />)}</div>
          <div className="sc-orb" />
          <div className="sc-cloud c1" /><div className="sc-cloud c2" /><div className="sc-cloud c3" />
        </>
      )}
      <svg className="sc-wave back" viewBox="0 0 3200 60" preserveAspectRatio="none"><path d={WAVE} /></svg>
      <div className="sc-boat"><BoatSvg /></div>
      <svg className="sc-wave front" viewBox="0 0 3200 60" preserveAspectRatio="none"><path d={WAVE} /></svg>
    </div>
  );
}

/** The whole portfolio as one fast scrolling page: same content, colours and fonts as the 3D world. */
export default function SimpleView({ data, open, reduceMotion, night, onToggleNight, onBack, onCopy }: Props) {
  const scroller = useRef<HTMLElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const counted = useRef(false);
  const [here, setHere] = useState("s-about");

  // Animated scrollbar: a paper boat sails down a flowing channel as you scroll, and can be dragged.
  useEffect(() => {
    const sc = scroller.current, r = rail.current;
    if (!open || !sc || !r) return;
    let idle = 0, raf = 0;
    const sync = () => {
      raf = 0;
      const max = sc.scrollHeight - sc.clientHeight;
      const p = max > 0 ? sc.scrollTop / max : 0;
      r.style.setProperty("--p", p.toFixed(4));
      bar.current?.style.setProperty("--p", p.toFixed(4));
      let current = NAV[0].id;
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = n.id;
      }
      setHere(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
      r.classList.add("moving");
      window.clearTimeout(idle);
      idle = window.setTimeout(() => r.classList.remove("moving"), 220);
    };
    let dragging = false;
    const seek = (e: PointerEvent) => {
      const box = r.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (e.clientY - box.top - 20) / (box.height - 40)));
      sc.scrollTop = p * (sc.scrollHeight - sc.clientHeight);
    };
    const down = (e: PointerEvent) => { dragging = true; r.setPointerCapture(e.pointerId); seek(e); };
    const move = (e: PointerEvent) => { if (dragging) seek(e); };
    const up = () => { dragging = false; };
    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    r.addEventListener("pointerdown", down); r.addEventListener("pointermove", move);
    r.addEventListener("pointerup", up); r.addEventListener("pointercancel", up);
    sync();
    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      r.removeEventListener("pointerdown", down); r.removeEventListener("pointermove", move);
      r.removeEventListener("pointerup", up); r.removeEventListener("pointercancel", up);
      window.clearTimeout(idle); cancelAnimationFrame(raf);
    };
  }, [open]);

  // Sections spring into place as they scroll into view.
  useEffect(() => {
    const sc = scroller.current;
    if (!open || !sc) return;
    const items = Array.from(sc.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    if (reduceMotion || !("IntersectionObserver" in window)) { items.forEach(i => i.classList.add("in")); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { root: sc, rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    items.forEach(i => io.observe(i));
    return () => io.disconnect();
  }, [open, reduceMotion]);

  // The headline numbers count up the first time the page opens.
  useEffect(() => {
    const sc = scroller.current;
    if (!open || !sc || counted.current || reduceMotion) return;
    counted.current = true;
    const tweens: gsap.core.Tween[] = [];
    sc.querySelectorAll<HTMLElement>(".s-hero .stats b").forEach((el, i) => {
      const m = (el.textContent || "").match(/^(\d+)(.*)$/);
      if (!m) return;
      const end = Number(m[1]), tail = m[2], o = { v: 0 };
      el.textContent = `0${tail}`;
      tweens.push(gsap.to(o, {
        v: end, duration: 1.4, delay: 0.5 + i * 0.15, ease: "power2.out",
        onUpdate: () => { el.textContent = `${Math.round(o.v)}${tail}`; }
      }));
    });
    return () => { tweens.forEach(t => t.progress(1).kill()); };
  }, [open, reduceMotion]);

  // Project cards tilt toward the pointer.
  useEffect(() => {
    const sc = scroller.current;
    if (!open || !sc || reduceMotion || window.matchMedia("(pointer: coarse)").matches) return;
    let last: HTMLElement | null = null;
    const reset = () => { last?.style.removeProperty("--rx"); last?.style.removeProperty("--ry"); last = null; };
    const move = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>(".proj-grid .proj");
      if (card !== last) reset();
      if (!card) return;
      last = card;
      const b = card.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      card.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-y * 9).toFixed(2)}deg`);
    };
    sc.addEventListener("pointermove", move);
    sc.addEventListener("pointerleave", reset);
    return () => { sc.removeEventListener("pointermove", move); sc.removeEventListener("pointerleave", reset); reset(); };
  }, [open, reduceMotion]);

  useEffect(() => {
    if (open) scroller.current?.focus({ preventScroll: true });
  }, [open]);

  const jump = (e: MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <>
      <main className="simple" ref={scroller} hidden={!open} tabIndex={-1} aria-label={`${data.name}: portfolio, simple view`}>
        <div className="simple-bar">
          <span className="mark">{data.name}</span>
          <nav className="simple-nav" aria-label="Sections">
            {NAV.map(n => (
              <a key={n.id} href={`#${n.id}`} className={here === n.id ? "here" : undefined} onClick={e => jump(e, n.id)}>{n.label}</a>
            ))}
          </nav>
          <div className="simple-tools">
            <ThemeToggle night={night} onToggle={onToggleNight} />
            {onBack && <button className="btn sm primary" type="button" onClick={onBack}>Back to the 3D sea</button>}
          </div>
        </div>

        <Scene />

        <div className="simple-inner">
          <header className="s-hero sticker reveal" id="s-about">
            <span className="eyebrow">{data.location}{data.availability ? ` · ${data.availability}` : ""}</span>
            <h1 aria-label={data.name}>
              {Array.from(data.name).map((ch, i) => (
                <span key={i} aria-hidden="true" style={{ "--i": i } as CSSProperties}>{ch === " " ? " " : ch}</span>
              ))}
            </h1>
            <p className="role">{data.title}</p>
            <p className="intro">{data.intro}</p>
            <Stats data={data} />
            <div className="link-row">
              <ResumeBtn data={data} cls="btn primary" />
              <a className="btn" href={`mailto:${data.contact.email}`}>Email me</a>
              {data.contact.links.map(l => <LinkBtn key={l.label} url={l.url} cls="btn">{l.label}</LinkBtn>)}
            </div>
          </header>

          <section className="s-section" aria-labelledby="h-do">
            <header className="reveal"><span className="eyebrow">What I do</span><h2 id="h-do">End to end, web to AI</h2></header>
            <div className="reveal"><Services data={data} /></div>
          </section>

          <section className="s-section" id="s-experience" aria-labelledby="h-exp">
            <header className="reveal"><span className="eyebrow">Experience</span><h2 id="h-exp">Where I&apos;ve worked</h2></header>
            <div className="s-card sticker reveal"><Timeline data={data} reveal /></div>
          </section>

          <section className="s-section" id="s-projects" aria-labelledby="h-proj">
            <header className="reveal"><span className="eyebrow">Projects</span><h2 id="h-proj">Things I&apos;ve built</h2></header>
            <div className="proj-grid">
              {data.projects.map((p, i) => <div className={`reveal ${i % 2 ? "from-r" : "from-l"}`} key={p.name}><ProjectCard p={p} /></div>)}
            </div>
          </section>

          <section className="s-section" id="s-skills" aria-labelledby="h-skills">
            <header className="reveal"><span className="eyebrow">Skills</span><h2 id="h-skills">What I work with</h2></header>
            <div className="two-col">
              <div className="s-card sticker reveal from-l"><Skills data={data} /></div>
              <div className="s-card sticker reveal from-r"><Background data={data} /></div>
            </div>
          </section>

          <section className="s-section" id="s-contact" aria-labelledby="h-contact">
            <header className="reveal"><span className="eyebrow">Contact</span><h2 id="h-contact">Let&apos;s talk</h2></header>
            <div className="s-card sticker reveal s-contact"><ContactBlock data={data} onCopy={onCopy} /></div>
          </section>

          <section className="s-cta reveal" aria-labelledby="h-cta">
            <h2 id="h-cta">Have a role or a project in mind?</h2>
            <p>I&apos;m one email away, and my résumé has the full story.</p>
            <div className="link-row">
              <a className="btn" href={`mailto:${data.contact.email}`}>Email me</a>
              <ResumeBtn data={data} cls="btn" />
            </div>
            <div className="cta-boat" aria-hidden="true"><BoatSvg /></div>
          </section>

          <footer className="s-foot">© {new Date().getFullYear()} {data.name}. Built with Next.js, React, Three.js and GSAP.</footer>
        </div>

        <Scene foot />
      </main>

      <div className="rail" ref={rail} hidden={!open} aria-hidden="true">
        <div className="rail-track"><div className="rail-fill" /></div>
        <div className="rail-boat"><BoatSvg /></div>
      </div>
      <div className="simple-progress" ref={bar} hidden={!open} aria-hidden="true" />
    </>
  );
}
