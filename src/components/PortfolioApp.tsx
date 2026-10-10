"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Portfolio } from "@/data/portfolio";
import { SECTIONS, sectionOf, toMapPct, type SectionId } from "@/world/layout";
import type { World } from "@/world/World";
import { Sfx } from "@/world/audio";
import Joystick from "./Joystick";
import Loader from "./Loader";
import Panel from "./Panel";
import SimpleView from "./SimpleView";
import { MailIcon, ResumeBtn, ThemeToggle } from "./sections";

type Phase = "loading" | "ready" | "intro" | "sailing" | "fallback";

interface Props {
  data: Portfolio;
  fonts: { display: string; mono: string };
}

export default function PortfolioApp({ data, fonts }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const sfx = useRef<Sfx | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const mapCanvas = useRef<HTMLCanvasElement>(null);
  const dockPrompt = useRef<HTMLButtonElement>(null);
  const timers = useRef<{ notice?: number; hint?: number; toast?: number; fade?: number }>({});

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [loaderGone, setLoaderGone] = useState(false);
  const [docked, setDocked] = useState<SectionId | null>(null);
  const [panelId, setPanelId] = useState<SectionId>("about");
  const [panelOpen, setPanelOpen] = useState(false);
  const [project, setProject] = useState(0);
  const [sailingTo, setSailingTo] = useState<SectionId | "spot" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [simple, setSimple] = useState(false);
  const [sound, setSound] = useState(false);
  const [night, setNight] = useState(false);
  const [mapBig, setMapBig] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [touch, setTouch] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [announce, setAnnounce] = useState("");

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(timers.current.notice);
    timers.current.notice = window.setTimeout(() => setNotice(null), 3200);
  }, []);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(timers.current.toast);
    timers.current.toast = window.setTimeout(() => setToast(null), 1900);
  }, []);

  /* ---------- Build the 3D world (once) ---------- */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const lowPower = coarse || Math.min(window.innerWidth, window.innerHeight) < 560;
    setReduceMotion(reduce);
    setTouch(coarse);
    if (window.location.hash === "#simple") setSimple(true);
    try { if (window.localStorage.getItem("theme") === "night") setNight(true); } catch { /* storage blocked */ }
    sfx.current = new Sfx();

    let cancelled = false;
    let built: World | null = null;
    (async () => {
      try {
        if (!canvas.current) throw new Error("no canvas");
        const { World } = await import("@/world/World"); // Three.js loads after first paint
        if (cancelled) return;
        built = new World(
          canvas.current, data, { reduceMotion: reduce, lowPower, fonts },
          {
            progress: setProgress,
            dock: (id, proj) => {
              setDocked(id); setPanelId(id); setProject(proj); setPanelOpen(true); setHint(false); setMapBig(false);
              if (coarse) { try { navigator.vibrate?.(18); } catch { /* no haptics */ } }
              setAnnounce(`Docked at ${sectionOf(id).place}. Panel opened.`);
            },
            undock: () => { setDocked(null); setPanelOpen(false); },
            sailing: (id, arrived) => {
              setSailingTo(id);
              if (id) setAnnounce(id === "spot" ? "Sailing to the spot you marked." : `Sailing to ${sectionOf(id).name}.`);
              else if (!arrived) flash("Auto-sail cancelled. You have the helm.");
            },
            moved: () => setHint(false),
            introDone: () => {
              setPhase("sailing"); setHint(true);
              timers.current.hint = window.setTimeout(() => setHint(false), 10000);
            },
            edge: () => flash("That's the edge of the map. The islands are behind you.")
          },
          () => ({ mapCanvas: mapCanvas.current, dockPrompt: dockPrompt.current }),
          sfx.current as Sfx
        );
        world.current = built;
        await built.build();
        if (cancelled) return;
        setProgress(1);
        setPhase("ready");
        // Deep link: /#play skips the loading screen button and starts sailing straight away.
        if (window.location.hash === "#play") { setPhase("intro"); built.start(); }
      } catch (err) {
        // WebGL unavailable or the world failed to build: the simple view has everything.
        console.error(err);
        if (!cancelled) { setPhase("fallback"); setSimple(true); }
      }
    })();

    const t = timers.current;
    return () => {
      cancelled = true;
      built?.dispose();
      world.current = null;
      window.clearTimeout(t.notice); window.clearTimeout(t.hint); window.clearTimeout(t.toast); window.clearTimeout(t.fade);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Keep the world in sync with the UI ---------- */
  useEffect(() => { world.current?.setPaused(simple); }, [simple, phase]);

  // Day / night: one switch drives the page palette and the 3D sky together.
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", night ? "#16143C" : "#FFD3A5");
    world.current?.setNight(night);
  }, [night, phase]);

  useEffect(() => {
    document.body.classList.toggle("panel-open", panelOpen);
    const sync = () => {
      const el = panelRef.current, w = world.current;
      if (!w) return;
      if (!panelOpen || !el) { w.setPanelInset(0, 0); return; }
      if (window.innerWidth <= 760) w.setPanelInset(0, el.offsetHeight * 0.42);
      else w.setPanelInset(el.offsetWidth / 2 + 8, 0);
    };
    sync();
    window.addEventListener("resize", sync);
    const ro = "ResizeObserver" in window && panelRef.current ? new ResizeObserver(sync) : null;
    if (ro && panelRef.current) ro.observe(panelRef.current);
    return () => { window.removeEventListener("resize", sync); ro?.disconnect(); };
  }, [panelOpen, panelId]);

  const closePanel = useCallback(() => {
    world.current?.dismiss();
    setDocked(null); setPanelOpen(false);
    document.querySelector<HTMLElement>(`[data-nav="${panelId}"]`)?.focus({ preventScroll: true });
  }, [panelId]);

  const inWorld = phase === "intro" || phase === "sailing";

  // Escape closes the big map first, then the panel. M toggles the big map.
  useEffect(() => {
    if (!inWorld || simple) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (mapBig) setMapBig(false); else if (panelOpen) closePanel(); }
      else if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) setMapBig(b => !b);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inWorld, simple, mapBig, panelOpen, closePanel]);

  /* ---------- Actions ---------- */
  const hideLoader = useCallback(() => setLoaderGone(true), []);
  const start = () => {
    setPhase("intro");
    world.current?.start();
  };
  const sailTo = useCallback((id: SectionId) => { world.current?.sailTo(id); }, []);
  const pickProject = useCallback((i: number) => { setProject(i); world.current?.setProject(i); }, []);
  const copyEmail = useCallback(async () => {
    try { await navigator.clipboard.writeText(data.contact.email); showToast("Email copied"); }
    catch { showToast(data.contact.email); }
  }, [data.contact.email, showToast]);
  const toggleSound = () => {
    const on = sfx.current?.toggle() ?? false;
    setSound(on);
    if (on) sfx.current?.click();
  };
  const toggleNight = useCallback(() => {
    // cross-fade every colour on the page while the 3D sky changes
    const root = document.documentElement;
    root.classList.add("theme-fade");
    window.clearTimeout(timers.current.fade);
    timers.current.fade = window.setTimeout(() => root.classList.remove("theme-fade"), 1300);
    setNight(n => {
      try { window.localStorage.setItem("theme", n ? "day" : "night"); } catch { /* storage blocked */ }
      return !n;
    });
  }, []);
  const uiClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("button, a");
    if (!el) return;
    sfx.current?.click();
    // After a mouse click on the HUD, hand the keyboard back to the boat (so Space hops instead of re-pressing the button).
    // Keyboard-initiated clicks (detail 0) keep their focus.
    if (e.detail > 0 && el.closest(".hud, .map-wrap")) window.setTimeout(() => el.blur(), 0);
  };
  // Small map: a click opens it. Big map: a click on the water sets a course for that spot.
  const onMapClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!mapBig) { setMapBig(true); return; }
    const b = e.currentTarget.getBoundingClientRect();
    world.current?.sailToMapPoint(((e.clientX - b.left) / b.width) * 100, ((e.clientY - b.top) / b.height) * 100);
  };

  /* ---------- Status pill: always says what is happening and what to do next ---------- */
  let status: ReactNode = null;
  if (phase === "intro") {
    status = (
      <>
        <span>Arriving at the archipelago<span className="dots" /></span>
        <button className="link-btn" type="button" onClick={() => world.current?.skipIntro()}>Skip intro</button>
      </>
    );
  } else if (sailingTo) {
    status = (
      <>
        <span className="pulse-arrow" aria-hidden="true">➜</span>
        <span>Sailing to {sailingTo === "spot" ? "your marked spot" : sectionOf(sailingTo).name}<span className="dots" /></span>
        <span className="mono">{touch ? "drag to cancel" : "press any movement key to cancel"}</span>
      </>
    );
  } else if (notice) {
    status = <span>{notice}</span>;
  } else if (hint && phase === "sailing") {
    status = touch
      ? <><span className="pulse-arrow" aria-hidden="true">➜</span><span>Tap anywhere to sail there, or drag to steer. Start with the island ahead.</span></>
      : <><span className="pulse-arrow" aria-hidden="true">➜</span><span>Sail with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, <kbd>Space</kbd> to hop, or click anywhere to sail there. Follow the arrow to the first island.</span></>;
  }

  const activeId = docked ?? null;

  return (
    <div onClickCapture={uiClick}>
      <canvas
        id="world" ref={canvas}
        aria-label="3D world: a paper boat sailing between five portfolio islands. Use the island navigation or the Simple view button to read everything without steering."
      />

      <div className="vignette" aria-hidden="true" />

      {/* Everything that floats over the 3D world */}
      <div id="ui" inert={!inWorld || simple}>
        <header className="hud">
          <div className="brand sticker">
            <span className="brand-name">{data.name}</span>
            <span className="brand-role">{data.title}</span>
          </div>

          <nav className="nav sticker" aria-label="Islands. Choose one to sail there automatically.">
            <ul>
              {SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button" data-nav={s.id} onClick={() => sailTo(s.id)}
                    className={activeId === s.id ? "active" : sailingTo === s.id ? "sailing" : undefined}
                    aria-current={activeId === s.id ? "location" : undefined}
                  >
                    <i>{i + 1}</i><span>{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="actions">
            <div className="tools">
              <ResumeBtn data={data} />
              <a className="btn sm" href={`mailto:${data.contact.email}`} aria-label={`Email ${data.contact.email}`}>
                <MailIcon /><span className="lbl">Email</span>
              </a>
              <button className="btn sm" id="soundBtn" type="button" aria-pressed={sound} aria-label={sound ? "Turn sound off" : "Turn sound on"} onClick={toggleSound}>
                <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9z" />
                  <path className="snd-on" d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
                  <path className="snd-off" d="m17 9.5 5 5m0-5-5 5" />
                </svg>
                <span className="lbl">{sound ? "Sound on" : "Sound off"}</span>
              </button>
              <ThemeToggle night={night} onToggle={toggleNight} />
            </div>
            <button className="btn sm primary" id="toSimple" type="button" onClick={() => setSimple(true)}>
              <span>Simple<span className="wide"> view</span></span>
            </button>
          </div>
        </header>

        <div className={mapBig ? "map-wrap big" : "map-wrap"}>
          <nav className="map sticker" aria-label="Live map. Choose an island to sail there.">
            <canvas className="map-canvas" ref={mapCanvas} onClick={onMapClick} aria-hidden="true" />
            {SECTIONS.map(s => {
              const [x, y] = toMapPct(s.x, s.z);
              return (
                <button
                  key={s.id} type="button" className={activeId === s.id ? "map-dot active" : "map-dot"}
                  style={{ left: `${x}%`, top: `${y}%` }} aria-label={`Sail to ${s.name}`} onClick={() => sailTo(s.id)}
                >
                  <span>{s.name}</span>
                </button>
              );
            })}
            <button
              className="icon-btn map-expand" type="button" aria-expanded={mapBig}
              aria-label={mapBig ? "Shrink the map" : "Expand the map"} onClick={() => setMapBig(b => !b)}
            >
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                {mapBig ? <path d="M9 4v5H4M15 20v-5h5M9 9 4 4M15 15l5 5" /> : <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" />}
              </svg>
            </button>
          </nav>
          <p className="map-legend">
            <i aria-hidden="true" />{mapBig ? "You are here · click the water to sail there" : "You are here"}
            {!touch && <kbd>M</kbd>}
          </p>
        </div>

        {touch && <Joystick onMove={(x, y) => world.current?.setJoy(x, y)} />}
        {touch && inWorld && (
          <button className="btn sm hop-btn" type="button" onClick={() => world.current?.hopBoat()}>Hop</button>
        )}

        {status && <div className="status sticker" role="status" aria-live="polite">{status}</div>}

        <button className="dock-prompt" ref={dockPrompt} type="button" style={{ display: "none" }} onClick={() => world.current?.dockNearest()}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.2" /><path d="M12 7.2V21M5 13a7 7 0 0 0 14 0M8.5 10.5h7" /></svg>
          Dock here {!touch && <kbd>E</kbd>}
        </button>

        <Panel
          data={data} id={panelId} open={panelOpen} project={project} reduceMotion={reduceMotion} panelRef={panelRef}
          onProject={pickProject} onClose={closePanel} onSail={sailTo} onCopy={copyEmail}
        />
      </div>

      {phase !== "fallback" && !loaderGone && (
        <div inert={simple}>
          <Loader
            name={data.name} title={data.title} progress={progress} ready={phase !== "loading"} leaving={inWorld}
            onStart={start} onSimple={() => setSimple(true)} onGone={hideLoader}
          />
        </div>
      )}

      <SimpleView
        data={data} open={simple} reduceMotion={reduceMotion} night={night} onToggleNight={toggleNight} onCopy={copyEmail}
        onBack={phase === "fallback" ? null : () => setSimple(false)}
      />

      <div className={toast ? "toast sticker show" : "toast sticker"} role="status">{toast}</div>
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}
