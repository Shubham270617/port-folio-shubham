"use client";

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import gsap from "gsap";
import type { Portfolio } from "@/data/portfolio";
import { SECTIONS, sectionOf, type SectionId } from "@/world/layout";
import { Background, ContactBlock, ProjectCard, ResumeBtn, Services, Skills, Stats, Timeline } from "./sections";

interface Props {
  data: Portfolio;
  id: SectionId;
  open: boolean;
  project: number;
  reduceMotion: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onProject: (i: number) => void;
  onClose: () => void;
  onSail: (id: SectionId) => void;
  onCopy: () => void;
}

const TITLES: Record<SectionId, string> = {
  about: "",
  experience: "Where I've worked",
  projects: "Things I've built",
  skills: "What I work with",
  contact: "Let's talk"
};

/** The content panel that slides in when the boat docks: right side on desktop, bottom sheet on phones. */
export default function Panel({ data, id, open, project, reduceMotion, panelRef, onProject, onClose, onSail, onCopy }: Props) {
  const title = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Phone bottom sheet: swipe up (or tap the handle) for a taller sheet, swipe down to shrink, then to close.
  const [tall, setTall] = useState(false);
  const swipe = useRef<{ id: number; y: number } | null>(null);
  const onGrabDown = (e: PointerEvent) => { swipe.current = { id: e.pointerId, y: e.clientY }; };
  const onGrabUp = (e: PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dy = e.clientY - s.y;
    if (dy < -36) setTall(true);
    else if (dy > 48) { if (tall) setTall(false); else onClose(); }
  };

  const idx = SECTIONS.findIndex(s => s.id === id);
  const prev = SECTIONS[(idx - 1 + SECTIONS.length) % SECTIONS.length];
  const next = SECTIONS[(idx + 1) % SECTIONS.length];
  const here = sectionOf(id);
  const heading = id === "about" ? `Hi, I'm ${data.name.split(" ")[0]}` : TITLES[id];

  // Slide in with a springy overshoot, then reveal the content piece by piece.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const d = (s: number) => (reduceMotion ? 0.01 : s);
    const sheet = window.innerWidth <= 760;
    gsap.killTweensOf(el);
    if (open) {
      gsap.fromTo(el,
        { autoAlpha: 0, xPercent: sheet ? 0 : 112, yPercent: sheet ? 112 : 0 },
        { autoAlpha: 1, xPercent: 0, yPercent: 0, duration: d(0.6), ease: "back.out(1.25)" });
      const items = bodyRef.current ? Array.from(bodyRef.current.children) : [];
      gsap.killTweensOf(items);
      gsap.fromTo(items, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: d(0.5), stagger: d(0.06), delay: d(0.16), ease: "back.out(1.7)" });
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      title.current?.focus({ preventScroll: true }); // announces the panel to screen readers
    } else {
      gsap.to(el, { autoAlpha: 0, xPercent: sheet ? 0 : 112, yPercent: sheet ? 112 : 0, duration: d(0.32), ease: "power2.in" });
    }
  }, [open, id, panelRef, reduceMotion]);

  // Switching project (by tab or by sailing to another lantern) pops the new card in.
  useEffect(() => {
    if (!open || id !== "projects" || !cardRef.current || reduceMotion) return;
    gsap.fromTo(cardRef.current, { scale: 0.92, rotate: -1.5 }, { scale: 1, rotate: 0, duration: 0.5, ease: "back.out(2)" });
  }, [project, open, id, reduceMotion]);

  return (
    <aside className={tall ? "panel sticker tall" : "panel sticker"} ref={panelRef} aria-labelledby="panelTitle" aria-hidden={!open}>
      <button
        className="grab" type="button" aria-label={tall ? "Shrink panel" : "Expand panel"} aria-expanded={tall}
        onClick={() => setTall(t => !t)}
      />
      <header className="panel-head" onPointerDown={onGrabDown} onPointerUp={onGrabUp} onPointerCancel={() => { swipe.current = null; }}>
        <div>
          <p className="eyebrow">Island {idx + 1} of {SECTIONS.length} · {here.place}</p>
          <h2 id="panelTitle" tabIndex={-1} ref={title}>{heading}</h2>
        </div>
        <button className="icon-btn" type="button" aria-label="Close panel and keep sailing" onClick={onClose}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div className="panel-body" ref={bodyRef} key={id}>
        {id === "about" && (
          <>
            <p className="sub">{data.title} · {data.location}</p>
            <p>{data.intro}</p>
            {data.availability && <p className="chip strong">{data.availability}</p>}
            <Stats data={data} />
            <h3>What I do</h3>
            <Services data={data} />
            <Background data={data} />
            <div className="link-row">
              <ResumeBtn data={data} cls="btn sm primary" />
              <button className="btn sm" type="button" onClick={() => onSail("contact")}>Contact me</button>
            </div>
          </>
        )}
        {id === "experience" && (
          <>
            <p className="sub">One stepping stone per role. The glowing one on top is where I am now. Tap a clip to pause it.</p>
            <Timeline data={data} />
          </>
        )}
        {id === "projects" && (
          <>
            <p className="sub">Each lantern in the bay is a project. Pick one here, or sail up to it.</p>
            <div className="tabs" role="tablist" aria-label="Projects">
              {data.projects.map((p, i) => (
                <button key={p.name} className="tab" type="button" role="tab" aria-selected={i === project} onClick={() => onProject(i)}>
                  {p.short}
                </button>
              ))}
            </div>
            <div ref={cardRef} role="tabpanel">
              {data.projects[project] && <ProjectCard p={data.projects[project]} />}
            </div>
          </>
        )}
        {id === "skills" && <Skills data={data} />}
        {id === "contact" && <ContactBlock data={data} onCopy={onCopy} />}
      </div>

      <footer className="panel-foot">
        <button className="btn sm two-line" type="button" onClick={() => onSail(prev.id)}>
          <span>← Previous island</span><small>{prev.name}</small>
        </button>
        <button className="btn sm primary two-line right" type="button" onClick={() => onSail(next.id)}>
          <span>Next island →</span><small>{next.name}</small>
        </button>
      </footer>
    </aside>
  );
}
