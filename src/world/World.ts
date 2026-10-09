/* Code Archipelago: the 3D world.
   A small imperative Three.js engine. React owns every piece of UI and talks to this
   class through a handful of methods (sailTo, dismiss, setProject…) and events. */

import * as THREE from "three";
import gsap from "gsap";
import type { Portfolio } from "@/data/portfolio";
import { SECTIONS, MAP_SCALE, fromMapPct, toMapPct, type SectionId } from "./layout";
import type { Sfx } from "./audio";

/* Palette: the same tokens as globals.css */
const C = {
  skyTop: 0xffd3a5, horizon: 0xff9f80, sea: 0x3fb8c4, seaHi: 0x8fe3e0, foam: 0xffffff, sand: 0xffe3b3,
  leaf: 0x7bc96f, leafDark: 0x4fa35c, accent: 0xff5a3c, glow: 0xffc93c, ink: 0x2b2140, paper: 0xfff8ee
};
const INK = "#2B2140", PAPER = "#FFF8EE", GLOW = "#FFC93C";

const MAX_SPEED = 18;
const DOCK_IN = 7.5;   // distance from the shore at which the boat docks
const DOCK_OUT = 12;   // distance at which it casts off again
const NEAR = 18;       // distance at which the island reacts and offers "Dock here"
const WORLD_LIMIT = 104;
const GROUND = 2.2;    // height of an island's grass
const START = { x: 0, z: -8 };

export interface WorldEvents {
  progress(p: number): void;
  dock(id: SectionId, project: number): void;
  undock(): void;
  sailing(id: SectionId | "spot" | null, arrived: boolean): void;
  moved(): void;
  introDone(): void;
  edge(): void;
}
export interface WorldHud {
  mapCanvas: HTMLCanvasElement | null;
  dockPrompt: HTMLElement | null;
}
export interface WorldOptions {
  reduceMotion: boolean;
  lowPower: boolean;
  fonts: { display: string; mono: string };
}

interface Island {
  id: SectionId; name: string; x: number; z: number; r: number;
  group: THREE.Group; label: THREE.Sprite; labelBase: THREE.Vector3;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  foams: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  near: number; labelY: number; focusY: number; popped: boolean;
  /** Preferred side to view the island from when docked (unit x/z), and extra camera distance. */
  view: [number, number] | null; pullBack: number;
}
interface Lantern { i: number; x: number; z: number; group: THREE.Group; halo: THREE.Sprite; phase: number; wob: number; }
interface Swayer { o: THREE.Object3D; ph: number; amp: number; }
interface Tag { s: THREE.Sprite; y: number; ph: number; base: THREE.Vector3; strong: boolean; pop: number; }
interface Gull { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; cx: number; cz: number; R: number; h: number; sp: number; ph: number; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ---------- small canvas helpers ---------- */
function softDot(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.4, "rgba(255,255,255,.5)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface LabelStyle { height?: number; bg?: string; fg?: string; font: string; size?: number; }
/** A sticker-style text label: cream pill, ink outline, ink text. */
function makeLabel(text: string, { height = 2.4, bg = PAPER, fg = INK, font, size = 52 }: LabelStyle): THREE.Sprite {
  const c = document.createElement("canvas"), g = c.getContext("2d") as CanvasRenderingContext2D;
  const f = `${font.replace("%s", String(size))}`;
  g.font = f;
  const w = Math.min(1024, Math.ceil(g.measureText(text).width + size * 1.3)), h = Math.ceil(size * 1.8);
  c.width = w; c.height = h;
  g.font = f; g.textAlign = "center"; g.textBaseline = "middle";
  const x = 4, y = 4, bw = w - 12, bh = h - 12, rad = bh / 2;
  const pill = (ox: number, oy: number) => {
    g.beginPath(); g.moveTo(x + ox + rad, y + oy); g.arcTo(x + ox + bw, y + oy, x + ox + bw, y + oy + bh, rad);
    g.arcTo(x + ox + bw, y + oy + bh, x + ox, y + oy + bh, rad); g.arcTo(x + ox, y + oy + bh, x + ox, y + oy, rad);
    g.arcTo(x + ox, y + oy, x + ox + bw, y + oy, rad); g.closePath();
  };
  pill(5, 5); g.fillStyle = INK; g.fill();            // solid offset shadow
  pill(0, 0); g.fillStyle = bg; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
  g.fillStyle = fg; g.fillText(text, x + bw / 2, y + bh / 2 + 2, bw - size * 0.6);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(height * w / h, height, 1);
  return s;
}

/* ---------- round "puff" particles (wake, splashes, smoke, sparkles) ---------- */
const puffScale = { value: 1 };
interface PuffOpts { gravity?: number; drag?: number; grow?: number; float?: boolean; opacity?: number; }
class Puffs {
  readonly n: number;
  readonly pos: Float32Array; readonly vel: Float32Array; readonly age: Float32Array; readonly life: Float32Array;
  readonly size0: Float32Array; readonly aSize: Float32Array; readonly aAlpha: Float32Array;
  private next = 0;
  private attrs: THREE.BufferAttribute[];
  constructor(scene: THREE.Scene, n: number, color: number, private o: PuffOpts = {}) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1e3); this.life = new Float32Array(n).fill(1);
    this.size0 = new Float32Array(n); this.aSize = new Float32Array(n); this.aAlpha = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    this.attrs = [new THREE.BufferAttribute(this.pos, 3), new THREE.BufferAttribute(this.aSize, 1), new THREE.BufferAttribute(this.aAlpha, 1)];
    this.attrs.forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("position", this.attrs[0]); geo.setAttribute("aSize", this.attrs[1]); geo.setAttribute("aAlpha", this.attrs[2]);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: puffScale, uOpacity: { value: o.opacity ?? 1 } },
      vertexShader: `
        attribute float aSize; attribute float aAlpha; uniform float uScale; varying float vA;
        void main() {
          vA = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.1, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.38, d) * vA * uOpacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 5;
    scene.add(points);
  }
  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number) {
    const i = this.next; this.next = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.size0[i] = size;
  }
  update(dt: number, heightAt: (x: number, z: number) => number) {
    const { gravity = 0, drag = 0, grow = 0, float = false } = this.o;
    const damp = Math.max(0, 1 - drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) { this.aAlpha[i] = 0; this.aSize[i] = 0; continue; }
      this.age[i] += dt;
      const k = i * 3;
      this.vel[k + 1] -= gravity * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      this.vel[k] *= damp; this.vel[k + 2] *= damp;
      if (float) this.pos[k + 1] = heightAt(this.pos[k], this.pos[k + 2]) + 0.18;
      const f = Math.max(0, 1 - this.age[i] / this.life[i]);
      this.aAlpha[i] = Math.min(1, f * 1.6);
      this.aSize[i] = this.size0[i] * (1 + grow * (1 - f));
    }
    this.commit();
  }
  commit() { this.attrs.forEach(a => { a.needsUpdate = true; }); }
}

/* ===================================================================== */
export class World {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private T = 0;
  private raf = 0;
  private disposed = false;
  private paused = false;
  private started = false;
  private controlsOn = false;
  private everDocked = false;
  private intro = { p: 0 };
  private introTl: gsap.core.Timeline | null = null;

  private amp: number;
  private ms: number; // motion scale for ambient animation
  private mats = new Map<number, THREE.MeshLambertMaterial>();
  private dot!: THREE.CanvasTexture;

  private sun!: THREE.DirectionalLight;
  private skyGroup = new THREE.Group();
  private water!: THREE.Mesh;
  private waterBase!: Float32Array;
  private waterPos!: THREE.BufferAttribute;
  private waterCol!: THREE.BufferAttribute;
  private waterCell = 4;

  private boatYaw = new THREE.Group();
  private boatInner = new THREE.Group();
  private flag!: THREE.Mesh;
  private boat = { x: START.x, z: START.z, vx: 0, vz: 0, heading: 0, turn: 0, roll: 0, pitch: 0, speed: 0 };

  private islands: Island[] = [];
  private lanterns: Lantern[] = [];
  private swayers: Swayer[] = [];
  private tags: Tag[] = [];
  private gulls: Gull[] = [];
  private clouds: THREE.Group[] = [];
  private beam: THREE.Group | null = null;
  private chimney: THREE.Object3D | null = null;
  private topHalo: THREE.Sprite | null = null;
  private arrow = new THREE.Group();
  private fish = { g: new THREE.Group(), inner: new THREE.Group(), t: -1, next: 3, x0: 0, z0: 0, dx: 1, dz: 0 };

  private wake!: Puffs; private splash!: Puffs; private smoke!: Puffs; private sparkles!: Puffs;
  private sparkBase!: Float32Array; private sparkPhase!: Float32Array;
  private wakeTimer = 0; private smokeTimer = 0; private lastBump = -9; private lastEdge = -9;
  private shake = 0;

  // Day / night. 0 is golden hour, 1 is a moonlit night; everything below blends between the two.
  private nightK = { v: 0 };
  private nightApplied = -1;
  private dayCol = {
    skyTop: new THREE.Color(C.skyTop), horizon: new THREE.Color(C.horizon), hemi: new THREE.Color(0xfff6ea), ground: new THREE.Color(C.sand),
    amb: new THREE.Color(C.skyTop), sun: new THREE.Color(0xffe9c7), sea: new THREE.Color(C.sea), seaHi: new THREE.Color(C.seaHi), cloud: new THREE.Color(C.paper)
  };
  private nightCol = {
    skyTop: new THREE.Color(0x16143c), horizon: new THREE.Color(0x5b4390), hemi: new THREE.Color(0xa29df0), ground: new THREE.Color(0x2f2c66),
    amb: new THREE.Color(0x4a418c), sun: new THREE.Color(0xc4ccff), sea: new THREE.Color(0x2f8fae), seaHi: new THREE.Color(0x7fe0ea), cloud: new THREE.Color(0x7468b5)
  };
  private skyMat!: THREE.ShaderMaterial;
  private hemi!: THREE.HemisphereLight;
  private amb!: THREE.AmbientLight;
  private sunDisc!: THREE.Mesh; private sunHalo!: THREE.Sprite;
  private moon!: THREE.Mesh; private moonHalo!: THREE.Sprite;
  private stars!: THREE.Points;
  private shoot!: THREE.Mesh;
  private shootState = { t: -1, next: 4, from: new THREE.Vector3(), dir: new THREE.Vector3() };
  private glowMats: { m: THREE.MeshLambertMaterial; base: number }[] = [];
  private halos: { s: THREE.Sprite; base: number }[] = [];
  private nightOnly: { s: THREE.Sprite; max: number }[] = [];
  private lamps: THREE.PointLight[] = [];
  private cloudMat!: THREE.MeshLambertMaterial;
  private beamMat!: THREE.MeshBasicMaterial;
  private beamBoost = 0;
  private fireflies!: Puffs; private ffBase!: Float32Array; private ffPhase!: Float32Array;
  private confetti: Puffs[] = [];
  private stones: THREE.Mesh[] = [];
  private balloon = new THREE.Group();
  private hop = { y: 0, v: 0 };
  // live map
  private trail: number[] = [];
  private trailT = 0;

  private keys = new Set<string>();
  private joy = { x: 0, y: 0 };
  private drag: { id: number; x: number; y: number; t: number; moved: boolean } | null = null;
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private spot!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  // adaptive resolution
  private pr = 1;
  private perfT = 0;
  private perfN = 0;
  private moved = false;

  private auto: { id: SectionId | null; x: number; z: number; stop: number } | null = null;
  private docked: SectionId | null = null;
  private suppressed: SectionId | null = null;
  private activeProject = 0;
  private lastLantern = -1;
  private nearest: Island | null = null;
  private promptIsl: Island | null = null;

  private cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), sx: 0, sy: 0, tx: 0, ty: 0 };
  private v1 = new THREE.Vector3(); private v2 = new THREE.Vector3(); private v3 = new THREE.Vector3(); private v4 = new THREE.Vector3();
  private seaA = new THREE.Color(C.sea); private seaB = new THREE.Color(C.seaHi);

  constructor(
    private canvas: HTMLCanvasElement,
    private P: Portfolio,
    private o: WorldOptions,
    private ev: WorldEvents,
    private hud: () => WorldHud,
    private sfx: Sfx
  ) {
    this.amp = o.reduceMotion ? 0.22 : 0.55;
    this.ms = o.reduceMotion ? 0.25 : 1;
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */

  /** Builds the scene step by step, reporting real progress to the loading screen. */
  async build(): Promise<void> {
    const { display, mono } = this.o.fonts;
    try {
      await Promise.race([
        Promise.all([document.fonts.load(`600 52px ${display}`), document.fonts.load(`500 44px ${mono}`)]),
        new Promise(r => setTimeout(r, 2000))
      ]);
    } catch { /* labels fall back to system fonts */ }
    this.ev.progress(0.12);

    const steps = [
      () => this.buildBase(), () => this.buildWater(), () => this.buildBoat(), () => this.buildAbout(),
      () => this.buildExperience(), () => this.buildProjects(), () => this.buildSkills(), () => this.buildContact(),
      () => this.buildLife(), () => this.buildParticles(), () => this.warmUp()
    ];
    for (let i = 0; i < steps.length; i++) {
      if (this.disposed) return;
      steps[i]();
      this.ev.progress(0.12 + 0.88 * (i + 1) / steps.length);
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    }
    if (this.disposed) return;
    this.listen();
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Called by the Start button. Runs the swoop-in intro (or skips it for reduced motion). */
  start() {
    if (this.started) return;
    this.started = true;
    this.clock.getDelta();
    if (this.o.reduceMotion) { this.finishIntro(); return; }
    const tl = gsap.timeline({ onComplete: () => this.finishIntro() });
    tl.to(this.intro, { p: 1, duration: 3.3, ease: "power2.inOut" }, 0);
    this.islands.forEach((isl, i) => tl.add(() => this.popIsland(isl), 0.55 + i * 0.36));
    this.introTl = tl;
  }

  skipIntro() {
    if (this.introTl) { this.introTl.kill(); this.introTl = null; }
    if (this.started && !this.controlsOn) this.finishIntro();
  }

  /** Auto-sail to an island (and optionally a specific project lantern). */
  sailTo(id: SectionId, project?: number) {
    if (!this.started) return;
    if (!this.controlsOn) this.skipIntro();
    if (project != null) this.activeProject = project;
    if (this.docked === id) { this.ev.dock(id, this.activeProject); return; }
    const isl = this.isl(id), b = this.boat;
    if (this.suppressed === id) this.suppressed = null;
    if (Math.hypot(b.x - isl.x, b.z - isl.z) - isl.r < DOCK_IN) { this.doDock(id, null); return; }
    if (this.docked) { this.suppressed = this.docked; this.docked = null; this.ev.undock(); }
    const L = id === "projects" && project != null ? this.lanterns[project] : null;
    this.auto = L ? { id, x: L.x, z: L.z, stop: 5 } : { id, x: isl.x, z: isl.z, stop: isl.r + 5 };
    this.ev.sailing(id, false);
  }

  /** The visitor pressed "Dock here" (or E). */
  dockNearest() {
    const isl = this.promptIsl;
    if (!isl || !this.controlsOn) return;
    this.suppressed = null;
    this.sailTo(isl.id);
  }

  /** The visitor closed the panel: stay put, but don't reopen it until they sail away and back. */
  dismiss() {
    if (!this.docked) return;
    this.suppressed = this.docked;
    this.docked = null;
  }

  /** Switch between golden hour and night: the sun sets, the moon rises, lamps and fireflies come out. */
  setNight(on: boolean) {
    gsap.killTweensOf(this.nightK);
    if (this.o.reduceMotion || !this.started) { this.nightK.v = on ? 1 : 0; return; }
    gsap.to(this.nightK, { v: on ? 1 : 0, duration: 2.2, ease: "power2.inOut" });
  }

  /** Auto-sail to any point on the sea (used by clicks on the big map). x/y are percent of the map. */
  sailToMapPoint(px: number, py: number) {
    const [x, z] = fromMapPct(px, py);
    this.sailToPoint(x, z);
  }

  /** Auto-sail to a point on the water (taps on the sea and clicks on the big map). */
  sailToPoint(x: number, z: number) {
    if (!this.controlsOn) return;
    const R = Math.hypot(x, z), lim = WORLD_LIMIT - 5;
    if (R > lim) { x *= lim / R; z *= lim / R; }
    for (const isl of this.islands) {
      if (Math.hypot(x - isl.x, z - isl.z) < isl.r + 5) { this.sailTo(isl.id); return; }
    }
    if (this.docked) { this.suppressed = this.docked; this.docked = null; this.ev.undock(); }
    this.auto = { id: null, x, z, stop: 3 };
    this.ev.sailing("spot", false);
  }

  /** Space bar makes the boat jump and land with a splash. */
  hopBoat() {
    if (!this.controlsOn || this.o.reduceMotion || this.hop.y > 0) return;
    this.hop.v = 8.5;
  }

  setProject(i: number) { this.activeProject = i; }
  setJoy(x: number, y: number) { this.joy.x = x; this.joy.y = y; }
  /** How much of the screen the open panel covers, so the camera can frame the island beside it. */
  setPanelInset(x: number, y: number) { this.cam.tx = x; this.cam.ty = y; }

  setPaused(p: boolean) {
    this.paused = p;
    this.keys.clear();
    if (!p) this.clock.getDelta();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.introTl?.kill();
    this.islands.forEach(i => gsap.killTweensOf(i.group.scale));
    this.lanterns.forEach(l => gsap.killTweensOf(l.group.scale));
    gsap.killTweensOf(this.intro);
    gsap.killTweensOf(this.nightK);
    this.stones.forEach(m => gsap.killTweensOf(m.scale));
    this.tags.forEach(t => gsap.killTweensOf(t));
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.renderer?.dispose();
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  private isl(id: SectionId): Island { return this.islands.find(i => i.id === id) as Island; }

  private mat(color: number): THREE.MeshLambertMaterial {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); this.mats.set(color, m); }
    return m;
  }
  private glowMat(intensity = 0.55) {
    const m = new THREE.MeshLambertMaterial({ color: C.glow, emissive: C.glow, emissiveIntensity: intensity, flatShading: true });
    this.glowMats.push({ m, base: intensity });
    return m;
  }
  /** A warm lamp that only switches on at night. Skipped on low-power devices. */
  private lamp(parent: THREE.Object3D, x: number, y: number, z: number, power: number, reach = 30) {
    if (this.o.lowPower) return;
    const l = new THREE.PointLight(C.glow, 0, reach, 2);
    l.position.set(x, y, z); l.userData.power = power;
    parent.add(l); this.lamps.push(l);
  }
  private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private label(text: string, height: number, opts: Partial<LabelStyle> = {}): THREE.Sprite {
    return makeLabel(text, { height, font: `600 %spx ${this.o.fonts.display}`, ...opts });
  }
  private monoLabel(text: string, height: number, opts: Partial<LabelStyle> = {}): THREE.Sprite {
    return makeLabel(text, { height, font: `500 %spx ${this.o.fonts.mono}`, size: 42, ...opts });
  }
  private halo(scale: number, opacity = 0.6): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: C.glow, transparent: true, opacity, depthWrite: false, fog: false }));
    s.scale.set(scale, scale, 1);
    this.halos.push({ s, base: opacity });
    return s;
  }

  /** Waves flatten out near the islands so the shoreline foam stays readable. */
  private calm(x: number, z: number): number {
    let f = 1;
    for (const s of SECTIONS) {
      const dx = x - s.x, dz = z - s.z, R = s.r + 16, d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        const k = Math.max(0, (Math.sqrt(d2) - s.r) / 16);
        f = Math.min(f, 0.15 + 0.85 * k * k);
      }
    }
    return f;
  }
  private waveH = (x: number, z: number): number => {
    const t = this.T;
    return this.amp * this.calm(x, z) *
      (0.55 * Math.sin(x * 0.07 + t * 0.8) + 0.45 * Math.sin(z * 0.09 + t * 1.05) + 0.35 * Math.sin((x + z) * 0.045 + t * 0.6));
  };

  /* ------------------------------------------------------------------ */
  /* Scene construction                                                  */
  /* ------------------------------------------------------------------ */
  private buildBase() {
    const low = this.o.lowPower;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !low, powerPreference: "high-performance" });
    this.pr = Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2);
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(C.horizon);
    this.scene.fog = new THREE.Fog(C.horizon, 200, 420);
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 1600);
    this.dot = softDot();

    // Warm, bright golden-hour light. Colours are tuned so lit faces land close to the palette tokens.
    this.hemi = new THREE.HemisphereLight(0xfff6ea, C.sand, 1.95);
    this.amb = new THREE.AmbientLight(C.skyTop, 0.4);
    this.scene.add(this.hemi, this.amb);
    const sun = new THREE.DirectionalLight(0xffe9c7, 1.55);
    sun.castShadow = !low;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    // Sky dome and sun follow the camera.
    this.scene.add(this.skyGroup);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(C.skyTop) }, bottom: { value: new THREE.Color(C.horizon) } },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
        void main() {
          float h = normalize(vP).y;
          gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 0.42, h)), 1.0);
          #include <colorspace_fragment>
        }`
    });
    this.skyMat = skyMat;
    this.skyGroup.add(new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), skyMat));
    const orb = new THREE.SphereGeometry(40, 20, 12);
    const glowSprite = (color: number, size: number) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sp.scale.set(size, size, 1);
      return sp;
    };
    this.sunDisc = new THREE.Mesh(orb, new THREE.MeshBasicMaterial({ color: C.paper, fog: false }));
    this.sunHalo = glowSprite(C.glow, 340);
    this.moon = new THREE.Mesh(orb, new THREE.MeshBasicMaterial({ color: 0xf3f1ff, fog: false }));
    this.moonHalo = glowSprite(0xcfd6ff, 300);
    this.skyGroup.add(this.sunDisc, this.sunHalo, this.moon, this.moonHalo);

    // Stars and the odd shooting star, only visible at night.
    const n = low ? 260 : 520, sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, y = 0.1 + Math.random() * 0.9, r = Math.sqrt(1 - y * y);
      sp.set([Math.cos(a) * r * 860, y * 860, Math.sin(a) * r * 860], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.shoot = new THREE.Mesh(new THREE.PlaneGeometry(90, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.shoot.visible = false;
    this.skyGroup.add(this.stars, this.shoot);
  }

  private buildWater() {
    const SIZE = 480, SEG = this.o.lowPower ? 80 : 120;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    this.waterPos = geo.attributes.position as THREE.BufferAttribute;
    this.waterPos.setUsage(THREE.DynamicDrawUsage);
    this.waterCol = new THREE.BufferAttribute(new Float32Array(this.waterPos.count * 3), 3);
    this.waterCol.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("color", this.waterCol);
    this.water = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.receiveShadow = true;
    this.waterCell = SIZE / SEG;
    this.waterBase = Float32Array.from(this.waterPos.array as Float32Array);
    this.scene.add(this.water);
  }

  private buildBoat() {
    const v: Record<string, number[]> = {
      kf: [0, 0, -1.7], kb: [0, 0, 1.7], tf: [0, 1.35, -3.3], tb: [0, 1.35, 3.3],
      l1: [-1.25, 1.1, -1.45], l2: [-1.25, 1.1, 1.45], r1: [1.25, 1.1, -1.45], r2: [1.25, 1.1, 1.45],
      d1: [-1.1, 0.95, -1.4], d2: [-1.1, 0.95, 1.4], d3: [1.1, 0.95, 1.4], d4: [1.1, 0.95, -1.4],
      sl1: [-0.32, 1.0, -1.5], sl2: [-0.32, 1.0, 1.5], sr1: [0.32, 1.0, -1.5], sr2: [0.32, 1.0, 1.5], peak: [0, 3.6, 0]
    };
    const tri = (list: string[][]) => {
      const arr: number[] = [];
      list.forEach(t => t.forEach(k => arr.push(...v[k])));
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      return g;
    };
    const paperGeo = tri([
      ["kf", "kb", "l2"], ["kf", "l2", "l1"], ["kf", "l1", "tf"], ["kb", "tb", "l2"],
      ["kf", "r2", "kb"], ["kf", "r1", "r2"], ["kf", "tf", "r1"], ["kb", "r2", "tb"],
      ["sl1", "sl2", "peak"], ["sr1", "peak", "sr2"], ["sl1", "peak", "sr1"], ["sl2", "sr2", "peak"]
    ]);
    const paper = new THREE.MeshLambertMaterial({ color: C.paper, flatShading: true, side: THREE.DoubleSide });
    const trim = new THREE.MeshLambertMaterial({ color: C.accent, flatShading: true, side: THREE.DoubleSide });
    const hull = new THREE.Mesh(paperGeo, paper); hull.castShadow = true;
    const deck = new THREE.Mesh(tri([["d1", "d2", "d3"], ["d1", "d3", "d4"]]), trim);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(paperGeo, 1), new THREE.LineBasicMaterial({ color: C.ink }));
    // accent trim: a little pennant on the peak
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 5), this.mat(C.ink)); pole.position.set(0, 4.3, 0);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.Float32BufferAttribute([0, 5.05, 0, 0, 4.35, 0, 0, 4.7, 1.2], 3));
    fg.computeVertexNormals();
    this.flag = new THREE.Mesh(fg, trim);
    this.boatInner.add(hull, deck, edges, pole, this.flag);
    this.boatInner.scale.setScalar(1.15);
    this.boatYaw.add(this.boatInner);
    // a lantern on the mast, lit at night
    const boatGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: C.glow, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    boatGlow.scale.set(5, 5, 1); boatGlow.position.set(0, 5.8, 0);
    this.boatYaw.add(boatGlow); this.nightOnly.push({ s: boatGlow, max: 0.8 });
    this.lamp(this.boatYaw, 0, 4, 0, 26, 16);
    this.boatYaw.position.set(this.boat.x, 0, this.boat.z);
    this.scene.add(this.boatYaw);

    // Guide arrow that points at the nearest island until the first docking.
    const shape = new THREE.Shape();
    ([[0, 3], [2.3, 0.3], [0.9, 0.3], [0.9, -2.6], [-0.9, -2.6], [-0.9, 0.3], [-2.3, 0.3]] as number[][])
      .forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    const arrowGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false });
    arrowGeo.rotateX(-Math.PI / 2); // lie flat on the water, pointing forward
    const face = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: C.accent, fog: false }));
    const rim = new THREE.LineSegments(new THREE.EdgesGeometry(arrowGeo), new THREE.LineBasicMaterial({ color: C.ink }));
    this.arrow.add(face, rim); this.arrow.rotation.order = "YXZ"; this.arrow.visible = false;

    // Ring that marks a tapped destination on the water.
    this.spot = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.2, 28),
      new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.spot.rotation.x = -Math.PI / 2; this.spot.visible = false;
    this.scene.add(this.spot);
    this.scene.add(this.arrow);
  }

  private addIsland(id: SectionId, labelY: number, focusY: number, viewAngle: number | null = null, pullBack = 0): THREE.Group {
    const s = SECTIONS.find(x => x.id === id)!;
    const r = s.r;
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); this.scene.add(g);
    this.add(g, new THREE.CylinderGeometry(r, r * 1.12, 3.6, 14), this.mat(C.sand), 0, -0.3, 0);
    this.add(g, new THREE.CylinderGeometry(r * 0.8, r * 0.86, 0.7, 14), this.mat(C.leaf), 0, 1.85, 0);

    // shoreline rocks: one instanced mesh per island
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), this.mat(C.paper), 7);
    const d = new THREE.Object3D();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6, rr = r * (1.04 + Math.random() * 0.08);
      d.position.set(Math.cos(a) * rr, 0.35, Math.sin(a) * rr);
      d.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      d.scale.setScalar(0.55 + Math.random() * 0.6);
      d.updateMatrix(); rocks.setMatrixAt(i, d.matrix);
    }
    rocks.castShadow = true; g.add(rocks);

    const label = this.label(s.name, 3.1); label.position.set(0, labelY, 0);
    label.material.depthTest = false; label.renderOrder = 10; g.add(label);

    const flat = (inner: number, width: number, color: number, y: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(inner, inner + width, 44),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m);
      return m;
    };
    const ring = flat(r * 1.3, 1.0, C.glow, 0.5);
    const foams = [flat(r * 1.08, 0.5, C.foam, 0.28), flat(r * 1.08, 0.5, C.foam, 0.3)];

    g.scale.setScalar(0.001);
    this.islands.push({ id, name: s.name, x: s.x, z: s.z, r, group: g, label, labelBase: label.scale.clone(), ring, foams, near: 0, labelY, focusY, popped: false, view: viewAngle == null ? null : [Math.cos(viewAngle), Math.sin(viewAngle)], pullBack });
    return g;
  }

  private tree(parent: THREE.Object3D, x: number, z: number, s = 1) {
    const t = new THREE.Group(); t.position.set(x, GROUND, z);
    this.add(t, new THREE.CylinderGeometry(0.2 * s, 0.32 * s, 1.8 * s, 6), this.mat(C.ink), 0, 0.9 * s, 0);
    this.add(t, new THREE.ConeGeometry(1.55 * s, 2.3 * s, 7), this.mat(C.leafDark), 0, 2.5 * s, 0);
    this.add(t, new THREE.ConeGeometry(1.1 * s, 1.9 * s, 7), this.mat(C.leaf), 0, 3.7 * s, 0);
    parent.add(t);
    this.swayers.push({ o: t, ph: Math.random() * 6, amp: 0.05 });
  }

  /* 1. About Island: a cosy cottage with a smoking chimney */
  private buildAbout() {
    const g = this.addIsland("about", 12.5, 4.5, Math.PI / 2 - 0.35);
    const house = new THREE.Group(); house.position.set(0, GROUND, -1); house.rotation.y = 0.35; g.add(house);
    this.add(house, new THREE.BoxGeometry(5.2, 3.6, 4.4), this.mat(C.paper), 0, 1.8, 0);
    const roof = this.add(house, new THREE.ConeGeometry(4.5, 2.9, 4), this.mat(C.accent), 0, 5.05, 0); roof.rotation.y = Math.PI / 4;
    this.add(house, new THREE.BoxGeometry(0.85, 2, 0.85), this.mat(C.sand), 1.3, 5.2, -0.6);
    const lit = new THREE.MeshBasicMaterial({ color: C.glow });
    const pane = new THREE.PlaneGeometry(1.1, 1.1);
    const w1 = new THREE.Mesh(pane, lit); w1.position.set(-1.5, 2.1, 2.21);
    const w2 = new THREE.Mesh(pane, lit); w2.position.set(1.5, 2.1, 2.21);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.9), this.mat(C.ink)); door.position.set(0, 0.95, 2.21);
    house.add(w1, w2, door);
    this.chimney = new THREE.Object3D(); this.chimney.position.set(1.3, 6.4, -0.6); house.add(this.chimney);
    this.lamp(house, 0, 2.6, 4.4, 75);
    this.tree(g, -5.6, 2, 1); this.tree(g, 5.4, 3, 0.8); this.tree(g, 4.2, -4.6, 1.15); this.tree(g, -4, -4.6, 0.9);
  }

  /* 2. Experience Island: one stepping stone per job, oldest at the bottom, current role glowing on top */
  private buildExperience() {
    const s = SECTIONS.find(x => x.id === "experience")!;
    const g = this.addIsland("experience", 17, 6.5, Math.atan2(-s.z, -s.x), 4);
    const jobs = [...this.P.experience].reverse(), n = jobs.length;
    const facing = Math.atan2(-s.z, -s.x), span = Math.min(2.3, 0.58 * (n - 1));
    jobs.forEach((j, i) => {
      const a = facing - span / 2 + (n > 1 ? (i / (n - 1)) * span : span / 2);
      const h = 1.2 + i * 1.9, px = Math.cos(a) * 5.6, pz = Math.sin(a) * 5.6, top = i === n - 1;
      const sg = new THREE.CylinderGeometry(1.7, 1.95, h, 8); sg.translate(0, h / 2, 0); // pivot at the base so stones can bounce
      this.stones.push(this.add(g, sg, top ? this.glowMat(0.6) : this.mat(C.paper), px, GROUND, pz));
      if (top) this.lamp(g, px * 1.5, GROUND + h + 2.5, pz * 1.5, 90);
      const year = (j.period.match(/\d{4}/) || [""])[0];
      const lbl = this.monoLabel(`${year} · ${j.short}`, top ? 1.25 : 1.05, top ? { bg: GLOW } : {});
      lbl.position.set(px * 1.12, GROUND + h + 1.15, pz * 1.12); lbl.material.depthTest = false; lbl.renderOrder = 8; g.add(lbl);
      if (top) {
        this.topHalo = this.halo(9, 0.55); this.topHalo.position.set(px, GROUND + h + 0.2, pz); g.add(this.topHalo);
      }
    });
    this.tree(g, 5.5, -3.5, 0.95); this.tree(g, 3, -6.5, 0.75);
  }

  /* 3. Projects Bay: one bobbing lantern-buoy per project */
  private buildProjects() {
    const s = SECTIONS.find(x => x.id === "projects")!;
    const facing = Math.atan2(-s.z, -s.x);
    const g = this.addIsland("projects", 10.5, 3, facing, 14);
    // a little jetty pointing at the lanterns
    const jetty = new THREE.Group(); jetty.rotation.y = -facing; g.add(jetty);
    for (let i = 0; i < 5; i++) this.add(jetty, new THREE.BoxGeometry(1.3, 0.3, 3.2), this.mat(i % 2 ? C.sand : C.paper), 4 + i * 1.45, 1.75, 0);
    this.add(jetty, new THREE.CylinderGeometry(0.16, 0.16, 3.6, 6), this.mat(C.ink), 2.4, GROUND + 1.8, 1.9);
    this.add(jetty, new THREE.CylinderGeometry(0.5, 0.4, 0.9, 6), this.glowMat(0.7), 2.4, GROUND + 3.9, 1.9);
    this.lamp(jetty, 3.4, GROUND + 4.4, 1.9, 80);
    this.tree(g, -3, -2.5, 0.9); this.tree(g, -1.5, 3.4, 0.7);

    const n = this.P.projects.length;
    const body = new THREE.CylinderGeometry(0.85, 0.7, 1.7, 6), cap = new THREE.ConeGeometry(1.15, 0.85, 6), float = new THREE.CylinderGeometry(1.25, 1.05, 0.75, 10);
    const glow = this.glowMat(0.75);
    this.P.projects.forEach((p, i) => {
      const a = facing + (i - (n - 1) / 2) * Math.min(0.5, 2.2 / Math.max(1, n - 1)), R = 16;
      const x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
      const L = new THREE.Group(); L.position.set(x, 0, z);
      this.add(L, float, this.mat(C.accent), 0, 0.15, 0);
      this.add(L, new THREE.CylinderGeometry(0.12, 0.12, 0.7, 5), this.mat(C.ink), 0, 0.85, 0);
      this.add(L, body, glow, 0, 2, 0);
      this.add(L, cap, this.mat(C.accent), 0, 3.25, 0);
      const halo = this.halo(7, 0.5); halo.position.y = 2; L.add(halo);
      const lbl = this.label(p.short, 1.05); lbl.position.y = 4.7; L.add(lbl);
      L.scale.setScalar(0.001);
      this.scene.add(L);
      this.lanterns.push({ i, x, z, group: L, halo, phase: i * 1.7, wob: 0 });
    });
  }

  /* 4. Skills Island: a tree with skill tags hanging like leaves */
  private buildSkills() {
    const g = this.addIsland("skills", 18.5, 8);
    this.add(g, new THREE.CylinderGeometry(0.7, 1.15, 6.4, 7), this.mat(C.ink), 0, GROUND + 3.2, 0);
    const crown = new THREE.Group(); crown.position.y = GROUND + 6; g.add(crown);
    ([[0, 3.2, 0, 3.8, C.leaf], [-2.5, 2, 1.1, 2.7, C.leafDark], [2.6, 2.2, -0.7, 2.8, C.leafDark], [0.4, 5.4, -0.4, 2.5, C.leaf], [0.3, 1.8, 2.4, 2.2, C.leaf]] as number[][])
      .forEach(([x, y, z, r, col]) => this.add(crown, new THREE.IcosahedronGeometry(r, 0), this.mat(col), x, y, z));
    this.swayers.push({ o: crown, ph: 1, amp: 0.025 });

    const also = this.P.skills.also.slice(0, this.o.lowPower ? 6 : 10);
    const all: [string, boolean][] = [...this.P.skills.strongest.map(s => [s, true] as [string, boolean]), ...also.map(s => [s, false] as [string, boolean])];
    const nStrong = this.P.skills.strongest.length;
    all.forEach(([text, strong], i) => {
      const k = i - nStrong;
      const a = strong ? (i / Math.max(1, nStrong)) * Math.PI * 2 + 0.5 : k * 2.39996;
      const y = strong ? GROUND + 3.6 + (i % 2) * 2.1 : GROUND + 8.4 + (k / Math.max(1, also.length)) * 6.6;
      const R = strong ? 7.6 : 6 + (k % 3) * 1.1;
      const s = strong ? this.monoLabel(text, 1.55, { bg: GLOW }) : this.monoLabel(text, 1.05);
      s.position.set(Math.cos(a) * R, y, Math.sin(a) * R); s.material.depthTest = false; s.renderOrder = strong ? 9 : 8; g.add(s);
      this.tags.push({ s, y, ph: i * 1.3, base: s.scale.clone(), strong, pop: 1 });
    });
  }

  /* 5. Contact Lighthouse: striped tower with a sweeping beam */
  private buildContact() {
    const g = this.addIsland("contact", 23.5, 9);
    const white = this.mat(C.paper), red = this.mat(C.accent);
    for (let i = 0; i < 6; i++) {
      const r0 = 2.5 - i * 0.17, r1 = 2.5 - (i + 1) * 0.17;
      this.add(g, new THREE.CylinderGeometry(r1, r0, 2.2, 12), i % 2 ? white : red, 0, GROUND + 1.1 + i * 2.2, 0);
    }
    const top = GROUND + 13.2;
    this.add(g, new THREE.CylinderGeometry(2.3, 2.3, 0.45, 12), this.mat(C.ink), 0, top + 0.2, 0);
    this.add(g, new THREE.CylinderGeometry(1.15, 1.15, 1.9, 8), this.glowMat(0.9), 0, top + 1.35, 0);
    this.add(g, new THREE.ConeGeometry(1.8, 1.9, 12), red, 0, top + 3.2, 0);
    const lampHalo = this.halo(8, 0.6); lampHalo.position.y = top + 1.35; g.add(lampHalo);
    this.beam = new THREE.Group(); this.beam.position.y = top + 1.35; g.add(this.beam);
    const beamMat = new THREE.MeshBasicMaterial({ color: C.glow, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamMat = beamMat;
    this.lamp(g, 0, top + 1.4, 3.4, 240, 46);
    [0, Math.PI].forEach(rot => {
      const arm = new THREE.Group(); arm.rotation.y = rot;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 40, 16, 1, true), beamMat);
      cone.rotation.z = Math.PI / 2; cone.position.x = 20; arm.add(cone);
      this.beam!.add(arm);
    });
    this.tree(g, 4.2, 2.6, 0.8); this.tree(g, -3.6, 3.6, 0.7);
  }

  /* Clouds, seagulls and a jumping fish */
  private buildLife() {
    const low = this.o.lowPower;
    const cm = new THREE.MeshLambertMaterial({ color: C.paper, flatShading: true, transparent: true, opacity: 0.94, fog: false });
    this.cloudMat = cm;
    const blob = new THREE.IcosahedronGeometry(1, 1);

    // A toy hot-air balloon drifting around the archipelago.
    const bal = this.balloon;
    const env = this.add(bal, new THREE.IcosahedronGeometry(4.2, 1), this.mat(C.accent), 0, 0, 0); env.scale.y = 1.18;
    this.add(bal, new THREE.CylinderGeometry(4.25, 4.25, 1.3, 14), this.mat(C.glow), 0, 0.3, 0);
    this.add(bal, new THREE.CylinderGeometry(1.5, 0.9, 2.2, 8), this.mat(C.paper), 0, -5.2, 0);
    this.add(bal, new THREE.BoxGeometry(1.5, 1.2, 1.5), this.mat(C.ink), 0, -8, 0);
    const burner = this.halo(5, 0.35); burner.position.y = -6.4; bal.add(burner);
    this.scene.add(bal);
    for (let i = 0; i < (low ? 5 : 8); i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(blob, cm); const s = 3.2 + Math.random() * 3;
        b.scale.set(s * 1.25, s * 0.8, s); b.position.set(k * 4.2 - 6, Math.random() * 1.6, Math.random() * 3); c.add(b);
      }
      c.position.set(-170 + Math.random() * 340, 44 + Math.random() * 20, -170 + Math.random() * 340);
      c.userData.v = 1.1 + Math.random() * 1.5;
      this.scene.add(c); this.clouds.push(c);
    }

    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, -0.45, 0, 0, 0.45, 2.3, 0, 0.1], 3));
    wingGeo.computeVertexNormals();
    const gm = new THREE.MeshLambertMaterial({ color: C.paper, flatShading: true, side: THREE.DoubleSide });
    const spots: [number, number][] = [[0, -6], [36, -30], [-40, 8], [24, 40]];
    spots.slice(0, low ? 2 : 4).forEach(([cx, cz], i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.7, 5), gm); body.rotation.x = Math.PI / 2; g.add(body);
      const wl = new THREE.Mesh(wingGeo, gm), wr = new THREE.Mesh(wingGeo, gm); wr.scale.x = -1; g.add(wl, wr);
      this.scene.add(g);
      this.gulls.push({ g, wl, wr, cx, cz, R: 16 + i * 5, h: 21 + i * 3, sp: 0.32 + i * 0.05, ph: i * 2.1 });
    });

    const f = this.fish;
    const fb = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 5), this.mat(C.glow)); fb.rotation.x = Math.PI / 2;
    const ft = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), this.mat(C.accent)); ft.rotation.x = -Math.PI / 2; ft.position.z = -1.05;
    f.inner.add(fb, ft); f.g.add(f.inner); f.g.visible = false; this.scene.add(f.g);
  }

  private buildParticles() {
    const low = this.o.lowPower, none = this.o.reduceMotion;
    this.wake = new Puffs(this.scene, none ? 1 : low ? 70 : 170, C.foam, { float: true, grow: 1.1, opacity: 0.8 });
    this.splash = new Puffs(this.scene, none ? 1 : low ? 60 : 150, C.foam, { gravity: 16, drag: 0.6 });
    this.smoke = new Puffs(this.scene, none ? 1 : 28, C.paper, { grow: 1.6, drag: 0.4, opacity: 0.85 });
    this.confetti = [C.accent, C.glow, C.leaf].map(c => new Puffs(this.scene, none ? 1 : low ? 16 : 40, c, { gravity: 9, drag: 1.1 }));
    const nf = none ? 1 : low ? 30 : 80;
    this.fireflies = new Puffs(this.scene, nf, C.glow, {});
    this.ffBase = new Float32Array(nf * 3); this.ffPhase = new Float32Array(nf);
    for (let i = 0; i < nf; i++) {
      const isl = SECTIONS[i % SECTIONS.length], a = Math.random() * Math.PI * 2, r = isl.r * 0.4 + Math.random() * (isl.r * 0.6 + 9);
      this.ffBase.set([isl.x + Math.cos(a) * r, 2.6 + Math.random() * 7, isl.z + Math.sin(a) * r], i * 3);
      this.ffPhase[i] = Math.random() * 30;
    }
    const n = none ? 1 : low ? 36 : 90;
    this.sparkles = new Puffs(this.scene, n, C.foam, {});
    this.sparkBase = new Float32Array(n * 2); this.sparkPhase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.sparkBase[i * 2] = (Math.random() - 0.5) * 130; this.sparkBase[i * 2 + 1] = (Math.random() - 0.5) * 130;
      this.sparkPhase[i] = Math.random() * 20;
    }
  }

  /** Compile shaders and upload geometry while the loading screen is still up. */
  private warmUp() {
    this.resize();
    this.introPose(this.cam.pos, this.cam.look);
    this.camera.position.copy(this.cam.pos); this.camera.lookAt(this.cam.look);
    this.applyNight();
    this.updateWater();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  /* ------------------------------------------------------------------ */
  /* Intro                                                               */
  /* ------------------------------------------------------------------ */
  private popIsland(isl: Island) {
    if (isl.popped) return;
    isl.popped = true;
    const quick = this.o.reduceMotion;
    const pop = (o: THREE.Object3D, delay = 0) => {
      if (quick) { o.scale.setScalar(1); return; }
      gsap.to(o.scale, { x: 1, y: 1, z: 1, duration: 1.25, delay, ease: "elastic.out(1, 0.5)" });
    };
    pop(isl.group);
    if (isl.id === "projects") this.lanterns.forEach((L, i) => pop(L.group, 0.25 + i * 0.09));
    if (!quick) {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, r = isl.r * 1.05;
        this.splash.spawn(isl.x + Math.cos(a) * r, 0.4, isl.z + Math.sin(a) * r, Math.cos(a) * (3 + Math.random() * 3), 6 + Math.random() * 5, Math.sin(a) * (3 + Math.random() * 3), 1.1, 0.9 + Math.random() * 0.7);
      }
      this.sfx.splash(0.5);
    }
  }

  private finishIntro() {
    this.introTl = null;
    gsap.killTweensOf(this.intro);
    this.intro.p = 1;
    this.islands.forEach(i => this.popIsland(i));
    this.followPose(this.cam.pos, this.cam.look);
    this.controlsOn = true;
    this.ev.introDone();
  }

  /* ------------------------------------------------------------------ */
  /* Input                                                               */
  /* ------------------------------------------------------------------ */
  private listen() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.paused || !this.controlsOn || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) { this.keys.add(k); e.preventDefault(); }
    else if (k === "e") this.dockNearest();
    else if (k === " " && !(t && (t.tagName === "BUTTON" || t.tagName === "A"))) { this.hopBoat(); e.preventDefault(); }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  private onBlur = () => { this.keys.clear(); };
  private onResize = () => { this.resize(); };
  // Dragging anywhere on the sea steers too (a floating joystick), for touch and mouse.
  private onPointerDown = (e: PointerEvent) => {
    if (!this.controlsOn) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
    this.canvas.setPointerCapture(e.pointerId);
  };
  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 12) return; // small wobble while tapping is not a drag
    d.moved = true;
    this.joy.x = clamp(dx / 70, -1, 1);
    this.joy.y = clamp(dy / 70, -1, 1);
  };
  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null; this.joy.x = this.joy.y = 0;
    if (e.type === "pointerup" && !d.moved && performance.now() - d.t < 450) this.tapAt(e.clientX, e.clientY);
  };

  /** A tap or click on the world: on an island or lantern it sails there, on open water it sails to that spot. */
  private tapAt(cx: number, cy: number) {
    const w = window.innerWidth, h = window.innerHeight;
    const hit = { go: null as (() => void) | null, d: 1e9 };
    const test = (x: number, y: number, z: number, radius: number, go: () => void) => {
      const v = this.v3.set(x, y, z).project(this.camera);
      if (v.z > 1) return;
      const dist = Math.hypot((v.x * 0.5 + 0.5) * w - cx, (-v.y * 0.5 + 0.5) * h - cy);
      if (dist < radius && dist < hit.d) { hit.d = dist; hit.go = go; }
    };
    for (const L of this.lanterns) test(L.x, 2.5, L.z, 44, () => this.sailTo("projects", L.i));
    for (const isl of this.islands) {
      test(isl.x, isl.focusY, isl.z, 84, () => this.sailTo(isl.id));
      test(isl.x, isl.labelY, isl.z, 70, () => this.sailTo(isl.id));
    }
    if (hit.go) { this.suppressed = null; hit.go(); return; }

    this.ray.setFromCamera(this.ndc.set((cx / w) * 2 - 1, -(cy / h) * 2 + 1), this.camera);
    const o = this.ray.ray.origin, dir = this.ray.ray.direction;
    if (dir.y > -0.02) return; // tapped the sky
    const t = -o.y / dir.y, x = o.x + dir.x * t, z = o.z + dir.z * t;
    if (Math.hypot(x - this.boat.x, z - this.boat.z) > 170) return;
    this.sailToPoint(x, z);
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    puffScale.value = this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
  }

  /* ------------------------------------------------------------------ */
  /* Per-frame updates                                                   */
  /* ------------------------------------------------------------------ */
  private frame = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.started || this.paused || document.hidden) return;
    const raw = this.clock.getDelta(), dt = Math.min(raw, 0.05);
    this.T += dt;
    if (raw < 0.5) {
      this.perfT += raw; this.perfN++;
      if (this.perfT >= 2) {
        const fps = this.perfN / this.perfT;
        this.perfT = 0; this.perfN = 0;
        if (fps < 27 && this.pr > 0.75 && this.controlsOn) {
          this.pr = Math.max(0.75, this.pr - 0.25);
          this.renderer.setPixelRatio(this.pr);
          this.resize();
        }
      }
    }
    this.updateBoat(dt);
    this.updateDocking(dt);
    this.updateWater();
    this.updateIslands(dt);
    this.updateLife(dt);
    this.updateSky(dt);
    this.updateParticles(dt);
    this.updateCamera(dt);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  };

  private updateBoat(dt: number) {
    const b = this.boat;
    let thr = 0, steer = 0;
    if (this.controlsOn) {
      const k = this.keys;
      if (k.has("w") || k.has("arrowup")) thr += 1;
      if (k.has("s") || k.has("arrowdown")) thr -= 1;
      if (k.has("a") || k.has("arrowleft")) steer += 1;
      if (k.has("d") || k.has("arrowright")) steer -= 1;
      thr = clamp(thr - this.joy.y, -1, 1); steer = clamp(steer - this.joy.x, -1, 1);
      if (Math.abs(thr) + Math.abs(steer) > 0.1) {
        if (this.auto) { this.auto = null; this.ev.sailing(null, false); }
        if (!this.moved) { this.moved = true; this.ev.moved(); }
      } else { thr = 0; steer = 0; }
    }

    if (this.auto) {
      const a = this.auto, tx = a.x - b.x, tz = a.z - b.z, dist = Math.hypot(tx, tz) || 1;
      let dx = tx / dist, dz = tz / dist;
      // steer around any island that sits between the boat and its destination
      for (const isl of this.islands) {
        if (isl.id === a.id) continue;
        const ox = isl.x - b.x, oz = isl.z - b.z, od = Math.hypot(ox, oz);
        if (od < isl.r + 16 && od < dist && ox * dx + oz * dz > 0) {
          const w = clamp(1 - (od - (isl.r + 4)) / 12, 0, 1);
          let px = -oz / od, pz = ox / od;
          if (px * dx + pz * dz < 0) { px = -px; pz = -pz; }
          dx = dx * (1 - w) + px * w; dz = dz * (1 - w) + pz * w;
        }
      }
      let diff = Math.atan2(-dx, -dz) - b.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      steer = clamp(diff * 2.2, -1, 1);
      thr = clamp(dist / 16, 0.3, 1) * (Math.abs(diff) > 1.1 ? 0.35 : 1);
      if (dist < a.stop) { this.auto = null; this.ev.sailing(null, true); }
    }

    // Velocity is kept separate from heading, so the boat drifts a little through turns.
    const fx = -Math.sin(b.heading), fz = -Math.cos(b.heading), rx = -fz, rz = fx;
    let vf = b.vx * fx + b.vz * fz, vr = b.vx * rx + b.vz * rz;
    const target = thr >= 0 ? thr * MAX_SPEED : thr * MAX_SPEED * 0.4;
    if (Math.abs(thr) > 0.01) vf += (target - vf) * Math.min(1, dt * 1.4);
    else vf *= Math.max(0, 1 - dt * (this.docked ? 2.8 : 0.8));
    vr *= Math.max(0, 1 - dt * 2.4);
    const grip = 0.35 + 0.65 * Math.min(1, (Math.abs(vf) / MAX_SPEED) * 1.6);
    b.turn += (steer * 1.75 * grip * (vf < -0.5 ? -1 : 1) - b.turn) * Math.min(1, dt * 5);
    b.heading += b.turn * dt;
    b.vx = fx * vf + rx * vr; b.vz = fz * vf + rz * vr;
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.speed = vf;

    // Bump into islands and lantern buoys.
    const hit = (cx: number, cz: number, min: number): boolean => {
      const dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz);
      if (d >= min || d < 0.001) return false;
      const nx = dx / d, nz = dz / d;
      b.x = cx + nx * min; b.z = cz + nz * min;
      const vn = b.vx * nx + b.vz * nz;
      if (vn < 0) {
        b.vx -= vn * 1.35 * nx; b.vz -= vn * 1.35 * nz;
        if (vn < -3.5 && this.T - this.lastBump > 0.35) this.bump(b.x - nx * 2, b.z - nz * 2, -vn);
      }
      return true;
    };
    for (const isl of this.islands) hit(isl.x, isl.z, isl.r * 1.08 + 2.3);
    for (const L of this.lanterns) if (hit(L.x, L.z, 3.3)) L.wob = Math.min(0.5, L.wob + 0.12);

    const R = Math.hypot(b.x, b.z);
    if (R > WORLD_LIMIT) {
      const nx = b.x / R, nz = b.z / R;
      b.x = nx * WORLD_LIMIT; b.z = nz * WORLD_LIMIT;
      const vn = b.vx * nx + b.vz * nz;
      if (vn > 0) { b.vx -= vn * nx; b.vz -= vn * nz; }
      if (this.T - this.lastEdge > 6) { this.lastEdge = this.T; this.ev.edge(); }
    }

    // Ride the waves: bob, pitch along the hull, bank into turns.
    const h = this.waveH(b.x, b.z);
    const hf = this.waveH(b.x + fx * 2.4, b.z + fz * 2.4), hb = this.waveH(b.x - fx * 2.4, b.z - fz * 2.4);
    b.pitch += (Math.atan2(hf - hb, 4.8) + vf * 0.004 - b.pitch) * Math.min(1, dt * 4);
    b.roll += (b.turn * 0.2 + Math.sin(this.T * 1.6) * 0.035 * this.ms - b.roll) * Math.min(1, dt * 4);
    const hp = this.hop;
    if (hp.v !== 0 || hp.y > 0) {
      hp.v -= 24 * dt; hp.y += hp.v * dt;
      if (hp.y <= 0) { hp.y = 0; hp.v = 0; this.bump(b.x, b.z, 7); }
    }
    this.boatYaw.position.set(b.x, h - 0.3 + hp.y, b.z);
    this.boatYaw.rotation.y = b.heading;
    this.boatInner.rotation.set(b.pitch + clamp(hp.v * 0.03, -0.3, 0.3), 0, b.roll);
    this.flag.rotation.y = Math.sin(this.T * 7) * 0.25 * this.ms - b.turn * 0.3;

    // Foam wake.
    this.wakeTimer += dt;
    if (!this.o.reduceMotion && Math.abs(vf) > 2 && this.wakeTimer > 0.045) {
      this.wakeTimer = 0;
      const k = Math.abs(vf) / MAX_SPEED;
      for (const s of [-1, 1]) {
        this.wake.spawn(b.x - fx * 3.3 + rx * s * 0.9, 0, b.z - fz * 3.3 + rz * s * 0.9, rx * s * 1.5 - fx * 0.5, 0, rz * s * 1.5 - fz * 0.5, 0.9 + k * 0.5, 0.32 + k * 0.3);
      }
      if (k > 0.5) this.wake.spawn(b.x + fx * 3.4, 0, b.z + fz * 3.4, (Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2, 0.5, 0.4);
    }
  }

  private bump(x: number, z: number, strength: number) {
    this.lastBump = this.T;
    this.sfx.splash(strength / 12);
    if (this.o.reduceMotion) return;
    this.shake = Math.min(0.5, strength * 0.035);
    const n = this.o.lowPower ? 8 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.5;
      this.splash.spawn(x, 0.5, z, Math.cos(a) * s, 4 + Math.random() * 4, Math.sin(a) * s, 0.8, 0.5 + Math.random() * 0.6);
    }
  }

  private doDock(id: SectionId, lantern: number | null) {
    this.docked = id;
    if (lantern != null) this.activeProject = lantern;
    if (this.auto) { this.auto = null; this.ev.sailing(null, true); }
    this.everDocked = true;
    this.sfx.chime();
    this.celebrate(this.isl(id));
    this.ev.dock(id, this.activeProject);
  }

  /** A little party every time the boat docks: confetti, a squash-and-stretch, and something specific per island. */
  private celebrate(isl: Island) {
    if (this.o.reduceMotion) return;
    for (const c of this.confetti) {
      for (let i = 0; i < Math.min(14, c.n); i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
        c.spawn(isl.x, isl.focusY + 3, isl.z, Math.cos(a) * sp, 5 + Math.random() * 6, Math.sin(a) * sp, 1.6 + Math.random() * 0.8, 0.35 + Math.random() * 0.35);
      }
    }
    if (isl.group.scale.x > 0.99) {
      gsap.fromTo(isl.group.scale, { x: 1.07, y: 0.88, z: 1.07 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: "elastic.out(1, 0.4)", overwrite: true });
    }
    if (isl.id === "experience") {
      this.stones.forEach((m, i) => gsap.fromTo(m.scale, { y: 0.45 }, { y: 1, duration: 1, delay: 0.12 + i * 0.09, ease: "elastic.out(1, 0.45)", overwrite: true }));
    } else if (isl.id === "skills") {
      this.tags.forEach((t, i) => gsap.fromTo(t, { pop: 0.2 }, { pop: 1, duration: 0.9, delay: i * 0.04, ease: "elastic.out(1, 0.5)", overwrite: true }));
    } else if (isl.id === "contact") {
      this.beamBoost = 5;
    } else if (isl.id === "projects") {
      this.lanterns.forEach(L => { L.wob = 0.35; });
    } else if (this.chimney) {
      const p = this.chimney.getWorldPosition(this.v4);
      for (let i = 0; i < 6; i++) this.smoke.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 1.6, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.6, 2.6, 1.5);
    }
  }

  private updateDocking(dt: number) {
    const b = this.boat;
    let nearest: Island | null = null, nd = 1e9;
    for (const isl of this.islands) {
      const d = Math.hypot(b.x - isl.x, b.z - isl.z) - isl.r;
      isl.near += ((d < NEAR ? 1 : 0) - isl.near) * Math.min(1, dt * 5);
      if (d < nd) { nd = d; nearest = isl; }
    }
    this.nearest = nearest;
    let lan = -1;
    for (const L of this.lanterns) if (Math.hypot(b.x - L.x, b.z - L.z) < 6.5) { lan = L.i; break; }

    if (this.suppressed) {
      const s = this.isl(this.suppressed);
      if (Math.hypot(b.x - s.x, b.z - s.z) - s.r > NEAR + 1) this.suppressed = null;
    }
    if (!this.controlsOn || !nearest) { this.promptIsl = null; return; }

    if (!this.docked) {
      const cand: SectionId | null = lan >= 0 ? "projects" : nd < DOCK_IN ? nearest.id : null;
      // while auto-sailing, only the destination can dock the boat
      if (cand && cand !== this.suppressed && (!this.auto || this.auto.id === cand)) this.doDock(cand, lan >= 0 ? lan : null);
    } else {
      const s = this.isl(this.docked);
      const d = Math.hypot(b.x - s.x, b.z - s.z) - s.r;
      if (d > DOCK_OUT && !(this.docked === "projects" && lan >= 0)) { this.docked = null; this.ev.undock(); }
      else if (this.docked === "projects" && lan >= 0 && lan !== this.lastLantern && lan !== this.activeProject) { this.activeProject = lan; this.ev.dock("projects", lan); }
    }
    this.lastLantern = lan;
    this.promptIsl = !this.docked && !this.auto && nd < NEAR ? nearest : null;
  }

  private updateWater() {
    const b = this.boat, cell = this.waterCell;
    const ox = Math.round(b.x / cell) * cell, oz = Math.round(b.z / cell) * cell;
    this.water.position.x = ox; this.water.position.z = oz;
    const pos = this.waterPos.array as Float32Array, col = this.waterCol.array as Float32Array, base = this.waterBase;
    const A = this.seaA, B = this.seaB, norm = 1 / (this.amp * 1.35);
    for (let i = 0, n = pos.length; i < n; i += 3) {
      const h = this.waveH(base[i] + ox, -base[i + 1] + oz);
      pos[i + 2] = h;
      let k = clamp((h * norm + 1) * 0.5, 0, 1); k = k * k;
      const foam = k > 0.8 ? (k - 0.8) * 2.2 : 0;
      col[i] = A.r + (B.r - A.r) * k + (1 - A.r) * foam;
      col[i + 1] = A.g + (B.g - A.g) * k + (1 - A.g) * foam;
      col[i + 2] = A.b + (B.b - A.b) * k + (1 - A.b) * foam;
    }
    this.waterPos.needsUpdate = true; this.waterCol.needsUpdate = true;

    // keep the shadow frustum centred on the boat
    this.sun.target.position.set(Math.round(b.x), 0, Math.round(b.z));
    this.sun.position.set(this.sun.target.position.x - 46, 60, this.sun.target.position.z - 70);
  }

  private updateIslands(dt: number) {
    const T = this.T, ms = this.ms;
    for (const isl of this.islands) {
      const grow = 1 + isl.near * 0.32 + isl.near * Math.sin(T * 4) * 0.03 * ms;
      isl.label.scale.set(isl.labelBase.x * grow, isl.labelBase.y * grow, 1);
      const docked = this.docked === isl.id;
      isl.ring.material.opacity = isl.near * (docked ? 0.25 : 0.45 + 0.3 * Math.sin(T * 4.5));
      isl.ring.scale.setScalar(1 + 0.05 * Math.sin(T * 4.5) * ms);
      isl.foams.forEach((f, k) => {
        const ph = (T * 0.22 * (ms < 1 ? 0.4 : 1) + k * 0.5) % 1;
        f.scale.setScalar(1 + ph * 0.22);
        f.material.opacity = (1 - ph) * 0.75;
      });
    }
    for (const s of this.swayers) {
      s.o.rotation.z = Math.sin(T * 1.2 + s.ph) * s.amp * ms;
      s.o.rotation.x = Math.cos(T * 0.9 + s.ph) * s.amp * 0.6 * ms;
    }
    for (const t of this.tags) {
      t.s.position.y = t.y + Math.sin(T * 1.5 + t.ph) * 0.18 * ms;
      const p = t.strong ? 1 + Math.sin(T * 2.6 + t.ph) * 0.06 * ms : 1;
      t.s.scale.set(t.base.x * p * t.pop, t.base.y * p * t.pop, 1);
    }
    for (const L of this.lanterns) {
      const active = this.docked === "projects" && L.i === this.activeProject;
      L.group.position.y = this.waveH(L.x, L.z) + Math.sin(T * 1.4 + L.phase) * 0.12 * ms;
      L.wob *= Math.max(0, 1 - dt * 2.2);
      L.group.rotation.z = Math.sin(T * 1.1 + L.phase) * 0.07 * ms + Math.sin(T * 9) * L.wob;
      L.group.rotation.x = Math.cos(T * 0.9 + L.phase) * 0.06 * ms;
      const hs = (active ? 11 : 7) + Math.sin(T * 3 + L.phase) * (active ? 1.4 : 0.5) * ms;
      L.halo.scale.x += (hs - L.halo.scale.x) * Math.min(1, dt * 6); L.halo.scale.y = L.halo.scale.x;
    }
    if (this.beam) this.beam.rotation.y += dt * (0.6 + this.beamBoost) * ms;
    this.beamBoost *= Math.max(0, 1 - dt * 0.9);
    if (this.topHalo) { const s = 9 + Math.sin(T * 2.4) * 1.5 * ms; this.topHalo.scale.set(s, s, 1); }
  }

  /** Blend every colour and light between day and night. Only does work while the value is changing. */
  private applyNight() {
    const v = this.nightK.v;
    if (v === this.nightApplied) return;
    this.nightApplied = v;
    const D = this.dayCol, N = this.nightCol, u = this.skyMat.uniforms;
    (u.top.value as THREE.Color).copy(D.skyTop).lerp(N.skyTop, v);
    const horizon = (u.bottom.value as THREE.Color).copy(D.horizon).lerp(N.horizon, v);
    (this.scene.background as THREE.Color).copy(horizon);
    (this.scene.fog as THREE.Fog).color.copy(horizon);
    this.hemi.color.copy(D.hemi).lerp(N.hemi, v); this.hemi.groundColor.copy(D.ground).lerp(N.ground, v);
    this.hemi.intensity = 1.95 - 0.5 * v;
    this.amb.color.copy(D.amb).lerp(N.amb, v); this.amb.intensity = 0.4 + (this.o.lowPower ? 0.6 : 0.2) * v;
    this.sun.color.copy(D.sun).lerp(N.sun, v); this.sun.intensity = 1.55 - 0.6 * v;
    this.seaA.copy(D.sea).lerp(N.sea, v); this.seaB.copy(D.seaHi).lerp(N.seaHi, v);
    this.cloudMat.color.copy(D.cloud).lerp(N.cloud, v);
    this.beamMat.opacity = 0.17 + 0.1 * v;
    (this.stars.material as THREE.PointsMaterial).opacity = v;

    // the sun sinks and shrinks while the moon rises
    this.sunDisc.position.set(-0.42, 0.17 - 0.13 * v, -0.89).normalize().multiplyScalar(800);
    this.sunDisc.scale.setScalar(Math.max(0.001, 1 - v)); this.sunHalo.position.copy(this.sunDisc.position);
    this.sunHalo.material.opacity = 0.7 * (1 - v);
    this.moon.position.set(0.48, 0.1 + 0.24 * v, -0.82).normalize().multiplyScalar(800);
    this.moon.scale.setScalar(Math.max(0.001, v * 0.8)); this.moonHalo.position.copy(this.moon.position);
    this.moonHalo.material.opacity = 0.55 * v;

    for (const g of this.glowMats) g.m.emissiveIntensity = g.base * (1 + 1.4 * v);
    for (const h of this.halos) h.s.material.opacity = Math.min(1, h.base * (1 + 0.8 * v));
    for (const h of this.nightOnly) h.s.material.opacity = h.max * v;
    for (const l of this.lamps) l.intensity = (l.userData.power as number) * v;
  }

  private updateSky(dt: number) {
    this.applyNight();
    const T = this.T, ms = this.ms, v = this.nightK.v;

    // hot-air balloon on a slow lap
    const a = T * 0.035 * ms + 2.2;
    this.balloon.position.set(Math.cos(a) * 78, 34 + Math.sin(T * 0.5) * 1.6 * ms, Math.sin(a) * 78);
    this.balloon.rotation.y = a * 0.6;
    this.balloon.rotation.z = Math.sin(T * 0.7) * 0.05 * ms;

    // shooting stars
    const st = this.shootState;
    if (v < 0.5 || this.o.reduceMotion) { this.shoot.visible = false; st.t = -1; return; }
    if (st.t < 0) {
      st.next -= dt;
      if (st.next <= 0) {
        const ang = Math.random() * Math.PI * 2, y = 0.35 + Math.random() * 0.35, r = Math.sqrt(1 - y * y);
        st.from.set(Math.cos(ang) * r, y, Math.sin(ang) * r).multiplyScalar(820);
        st.dir.set(-Math.sin(ang), -0.25, Math.cos(ang)).normalize();
        st.t = 0; this.shoot.visible = true;
      }
    } else {
      st.t += dt / 0.9;
      this.shoot.position.copy(st.from).addScaledVector(st.dir, st.t * 260);
      this.shoot.lookAt(this.camera.position);
      (this.shoot.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.min(1, st.t) * Math.PI) * 0.9;
      if (st.t >= 1) { st.t = -1; st.next = 3 + Math.random() * 6; this.shoot.visible = false; }
    }
  }

  private updateLife(dt: number) {
    const T = this.T, ms = this.ms, b = this.boat;
    for (const c of this.clouds) { c.position.x += c.userData.v * dt * ms; if (c.position.x > 200) c.position.x = -200; }
    for (const g of this.gulls) {
      const a = T * g.sp * ms + g.ph;
      g.g.position.set(g.cx + Math.cos(a) * g.R, g.h + Math.sin(a * 2.3) * 1.2, g.cz + Math.sin(a) * g.R);
      g.g.rotation.set(0, -a, -0.25);
      const flap = Math.sin(T * 7 + g.ph) * 0.55 * (ms < 1 ? 0.3 : 1);
      g.wl.rotation.z = flap; g.wr.rotation.z = -flap;
    }

    // a fish jumps near the boat every few seconds
    const f = this.fish;
    if (this.o.reduceMotion || !this.controlsOn) return;
    if (f.t < 0) {
      f.next -= dt;
      if (f.next <= 0) {
        const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 8, dir = Math.random() * Math.PI * 2;
        f.x0 = b.x + Math.cos(a) * d; f.z0 = b.z + Math.sin(a) * d;
        if (this.calm(f.x0, f.z0) < 0.95) { f.next = 0.5; return; }
        f.dx = Math.cos(dir); f.dz = Math.sin(dir); f.t = 0;
        f.g.rotation.y = Math.atan2(f.dx, f.dz); f.g.visible = true;
        this.fishSplash(f.x0, f.z0);
      }
    } else {
      f.t += dt / 0.95;
      const p = f.t, x = f.x0 + f.dx * 5 * p, z = f.z0 + f.dz * 5 * p;
      f.g.position.set(x, this.waveH(x, z) - 0.4 + 14 * p * (1 - p), z);
      f.inner.rotation.x = -Math.atan2(14 * (1 - 2 * p), 5);
      if (p >= 1) { f.t = -1; f.next = 4 + Math.random() * 5; f.g.visible = false; this.fishSplash(x, z); }
    }
  }
  private fishSplash(x: number, z: number) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      this.splash.spawn(x, 0.3, z, Math.cos(a) * 1.6, 3 + Math.random() * 2.5, Math.sin(a) * 1.6, 0.6, 0.35 + Math.random() * 0.3);
    }
    this.sfx.splash(0.18);
  }

  private updateParticles(dt: number) {
    if (this.o.reduceMotion) return;
    const T = this.T, b = this.boat;
    this.smokeTimer += dt;
    if (this.chimney && this.smokeTimer > 0.42 && this.isl("about").popped) {
      this.smokeTimer = 0;
      const p = this.chimney.getWorldPosition(this.v4);
      this.smoke.spawn(p.x, p.y, p.z, 0.5 + Math.random() * 0.4, 1.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4, 3.2, 1.3);
    }
    this.wake.update(dt, this.waveH);
    this.splash.update(dt, this.waveH);
    this.smoke.update(dt, this.waveH);
    for (const c of this.confetti) c.update(dt, this.waveH);

    // fireflies drift around the islands after dark
    const ff = this.fireflies, nv = this.nightK.v;
    if (nv > 0.01 || ff.aAlpha[0] > 0) {
      for (let i = 0; i < ff.n; i++) {
        const ph = this.ffPhase[i], k = i * 3;
        ff.pos[k] = this.ffBase[k] + Math.sin(T * 0.5 + ph) * 2.2;
        ff.pos[k + 1] = this.ffBase[k + 1] + Math.sin(T * 0.9 + ph * 2) * 0.9;
        ff.pos[k + 2] = this.ffBase[k + 2] + Math.cos(T * 0.4 + ph) * 2.2;
        const tw = 0.5 + 0.5 * Math.sin(T * 2.4 + ph * 3);
        ff.aAlpha[i] = nv * (0.25 + 0.75 * tw); ff.aSize[i] = 0.28 + tw * 0.22;
      }
      ff.commit();
    }

    // sparkles: fixed spots on the water that twinkle, wrapped around the boat
    const s = this.sparkles, W = 130;
    for (let i = 0; i < s.n; i++) {
      const bx = this.sparkBase[i * 2], bz = this.sparkBase[i * 2 + 1];
      const x = bx + Math.round((b.x - bx) / W) * W, z = bz + Math.round((b.z - bz) / W) * W;
      const tw = Math.max(0, Math.sin(T * 1.7 + this.sparkPhase[i]));
      s.pos[i * 3] = x; s.pos[i * 3 + 1] = this.waveH(x, z) + 0.2; s.pos[i * 3 + 2] = z;
      s.aAlpha[i] = tw * tw * tw * tw; s.aSize[i] = 0.25 + tw * 0.4;
    }
    s.commit();
  }

  /* ------------------------------------------------------------------ */
  /* Camera                                                              */
  /* ------------------------------------------------------------------ */
  private narrow() { return window.innerWidth <= 760; }

  private introPose(pos: THREE.Vector3, look: THREE.Vector3) {
    pos.set(this.boat.x + 10, 118, this.boat.z + 128); look.set(0, 0, -8);
  }
  private followPose(pos: THREE.Vector3, look: THREE.Vector3) {
    const b = this.boat, n = this.narrow(), sp = Math.min(1, Math.abs(b.speed) / MAX_SPEED);
    const fx = -Math.sin(b.heading), fz = -Math.cos(b.heading);
    const back = (n ? 28 : 21) + sp * 6.5, up = (n ? 15 : 10.5) + sp * 2.5; // eases out at speed
    pos.set(b.x - fx * back, up, b.z - fz * back);
    look.set(b.x + fx * 7, 2.4, b.z + fz * 7);
  }
  private dockPose(isl: Island, pos: THREE.Vector3, look: THREE.Vector3) {
    const b = this.boat, n = this.narrow();
    let dx = b.x - isl.x, dz = b.z - isl.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    if (isl.view) {
      dx = dx * 0.45 + isl.view[0] * 0.55; dz = dz * 0.45 + isl.view[1] * 0.55;
      const m = Math.hypot(dx, dz);
      if (m < 0.25) { dx = isl.view[0]; dz = isl.view[1]; } else { dx /= m; dz /= m; }
    }
    const dist = isl.r + isl.focusY * 1.5 + isl.pullBack + (n ? 34 : 22);
    pos.set(isl.x + dx * dist, isl.focusY + (n ? 15 : 9), isl.z + dz * dist);
    look.set(isl.x, isl.focusY, isl.z);
  }

  private updateCamera(dt: number) {
    const cam = this.cam, P = this.v1, L = this.v2;
    const framed = this.docked && !this.o.reduceMotion ? this.isl(this.docked) : null;
    if (framed) this.dockPose(framed, P, L); else this.followPose(P, L);

    if (this.intro.p < 1) {
      this.introPose(this.v3, this.v4);
      cam.pos.lerpVectors(this.v3, P, this.intro.p);
      cam.look.lerpVectors(this.v4, L, this.intro.p);
    } else {
      const k = 1 - Math.exp(-dt * (framed ? 2.2 : 2.7));
      cam.pos.lerp(P, k);
      cam.look.lerp(L, Math.min(1, k * 1.35));
    }
    const fog = this.scene.fog as THREE.Fog, p = this.intro.p;
    fog.near = 200 - 130 * p; fog.far = 420 - 215 * p;

    this.camera.position.copy(cam.pos);
    if (this.shake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.max(0, 1 - dt * 7);
    }
    this.camera.lookAt(cam.look);

    // Slide the view over so the island sits beside (or above) the open panel.
    const tx = framed ? cam.tx : 0, ty = framed ? cam.ty : 0, e = Math.min(1, dt * 3.5);
    cam.sx += (tx - cam.sx) * e; cam.sy += (ty - cam.sy) * e;
    if (Math.abs(cam.sx) > 0.5 || Math.abs(cam.sy) > 0.5) {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.setViewOffset(w, h, cam.sx, cam.sy, w, h);
    } else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();

    this.skyGroup.position.copy(this.camera.position);
  }

  /* ------------------------------------------------------------------ */
  /* HUD elements that move every frame                                  */
  /* ------------------------------------------------------------------ */
  /** The live map: island shapes, lanterns, the boat's trail, the auto-sail route and a "you are here" pulse. */
  private drawMap(cv: HTMLCanvasElement | null) {
    if (!cv) return;
    const size = cv.clientWidth;
    if (!size) return;
    const px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const g = cv.getContext("2d");
    if (!g) return;
    const u = px / 100, T = this.T, b = this.boat, night = this.nightK.v > 0.5, TAU = Math.PI * 2;
    const P = (x: number, z: number): [number, number] => { const [mx, my] = toMapPct(x, z); return [mx * u, my * u]; };

    // remember where the boat has been
    const tr = this.trail, n0 = tr.length;
    if (T - this.trailT > 0.18 && (n0 === 0 || Math.hypot(b.x - tr[n0 - 2], b.z - tr[n0 - 1]) > 1.6)) {
      this.trailT = T; tr.push(b.x, b.z);
      if (tr.length > 360) tr.splice(0, 2);
    }

    g.clearRect(0, 0, px, px);
    const sea = g.createRadialGradient(px * 0.4, px * 0.35, 0, px / 2, px / 2, px * 0.62);
    sea.addColorStop(0, night ? "#2c8a9d" : "#8FE3E0"); sea.addColorStop(1, night ? "#173f5c" : "#3FB8C4");
    g.fillStyle = sea; g.fillRect(0, 0, px, px);

    // drifting wave marks
    g.strokeStyle = night ? "rgba(143,227,224,.35)" : "rgba(255,255,255,.6)"; g.lineWidth = Math.max(1, u * 0.5); g.lineCap = "round";
    for (let i = 0; i < 16; i++) {
      const wx = ((i * 37.7 + T * (1.2 + (i % 3) * 0.5) * this.ms) % 110) - 5, wy = (i * 61.3) % 100;
      g.beginPath(); g.moveTo(wx * u, wy * u);
      g.quadraticCurveTo((wx + 1.5) * u, (wy - 1.2) * u, (wx + 3) * u, wy * u); g.stroke();
    }

    // trail
    for (let i = 0; i < tr.length; i += 2) {
      const [x, y] = P(tr[i], tr[i + 1]);
      g.globalAlpha = (i / tr.length) * 0.85;
      g.fillStyle = "#FFFFFF"; g.beginPath(); g.arc(x, y, u * 0.7, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;

    // auto-sail route
    const [bx, by] = P(b.x, b.z);
    if (this.auto) {
      const [tx, ty] = P(this.auto.x, this.auto.z);
      g.setLineDash([u * 2.2, u * 1.8]); g.lineDashOffset = -T * u * 9;
      g.strokeStyle = "#FF5A3C"; g.lineWidth = u * 1.1;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      const pulse = (T * 1.4) % 1;
      g.globalAlpha = 1 - pulse; g.lineWidth = u * 0.8;
      g.beginPath(); g.arc(tx, ty, u * (2 + pulse * 6), 0, TAU); g.stroke(); g.globalAlpha = 1;
      if (this.auto.id === null) { // a marked spot on open water
        g.fillStyle = "#FF5A3C"; g.strokeStyle = INK; g.lineWidth = u * 0.5;
        g.beginPath(); g.arc(tx, ty, u * 1.6, 0, TAU); g.fill(); g.stroke();
      }
    }

    // islands
    for (const isl of this.islands) {
      const [x, y] = P(isl.x, isl.z), r = isl.r * MAP_SCALE * u * 1.25;
      const hot = this.docked === isl.id || isl.near > 0.5;
      if (hot) {
        g.fillStyle = "rgba(255,201,60," + (0.35 + 0.25 * Math.sin(T * 5)) + ")";
        g.beginPath(); g.arc(x, y, r * 1.7, 0, TAU); g.fill();
      }
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(x, y, r * (1.22 + 0.08 * Math.sin(T * 2 + isl.x)), 0, TAU); g.fill(); // surf
      g.fillStyle = "#FFE3B3"; g.strokeStyle = INK; g.lineWidth = Math.max(1, u * 0.45);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = "#7BC96F"; g.beginPath(); g.arc(x, y, r * 0.7, 0, TAU); g.fill();
      // a tiny landmark per island
      g.fillStyle = isl.id === "skills" ? "#4FA35C" : isl.id === "projects" ? "#FFC93C" : "#FF5A3C";
      g.beginPath();
      if (isl.id === "about") { g.moveTo(x - r * 0.45, y + r * 0.1); g.lineTo(x, y - r * 0.5); g.lineTo(x + r * 0.45, y + r * 0.1); }
      else if (isl.id === "experience") { g.rect(x - r * 0.45, y, r * 0.3, r * 0.3); g.rect(x - r * 0.15, y - r * 0.2, r * 0.3, r * 0.5); g.rect(x + r * 0.15, y - r * 0.45, r * 0.3, r * 0.75); }
      else if (isl.id === "contact") { g.rect(x - r * 0.16, y - r * 0.55, r * 0.32, r * 0.95); }
      else g.arc(x, y - r * 0.05, r * 0.38, 0, TAU);
      g.fill();
    }

    // project lanterns
    for (const L of this.lanterns) {
      const [x, y] = P(L.x, L.z), on = this.docked === "projects" && L.i === this.activeProject;
      g.fillStyle = "rgba(255,201,60,.45)"; g.beginPath(); g.arc(x, y, u * (on ? 2.6 : 1.6 + 0.3 * Math.sin(T * 3 + L.phase)), 0, TAU); g.fill();
      g.fillStyle = "#FFC93C"; g.strokeStyle = INK; g.lineWidth = Math.max(1, u * 0.3);
      g.beginPath(); g.arc(x, y, u * (on ? 1.2 : 0.8), 0, TAU); g.fill(); g.stroke();
    }

    // the boat, with a "you are here" pulse
    const ping = (T * 0.9) % 1;
    g.strokeStyle = "rgba(255,90,60," + (1 - ping) + ")"; g.lineWidth = u * 0.7;
    g.beginPath(); g.arc(bx, by, u * (2.5 + ping * 5), 0, TAU); g.stroke();
    g.save(); g.translate(bx, by); g.rotate(-b.heading);
    g.fillStyle = "#FF5A3C"; g.strokeStyle = INK; g.lineWidth = Math.max(1, u * 0.5); g.lineJoin = "round";
    g.beginPath(); g.moveTo(0, -u * 3.4); g.lineTo(u * 2.2, u * 2.4); g.lineTo(0, u * 1.4); g.lineTo(-u * 2.2, u * 2.4); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  private updateHud() {
    const hud = this.hud(), b = this.boat, T = this.T;
    this.drawMap(hud.mapCanvas);

    const prompt = hud.dockPrompt, isl = this.promptIsl;
    if (prompt) {
      let show = false;
      if (isl && this.controlsOn) {
        const v = this.v3.set(isl.x, isl.labelY - 3.9, isl.z).project(this.camera);
        if (v.z < 1) {
          const w = window.innerWidth, h = window.innerHeight;
          prompt.style.left = clamp((v.x * 0.5 + 0.5) * w, 100, w - 100) + "px";
          prompt.style.top = clamp((-v.y * 0.5 + 0.5) * h, 130, h - 130) + "px";
          show = true;
        }
      }
      const want = show ? "inline-flex" : "none";
      if (prompt.style.display !== want) prompt.style.display = want;
    }

    const sp = this.auto && this.auto.id === null ? this.auto : null;
    this.spot.visible = !!sp;
    if (sp) {
      const k = (T * 1.2) % 1;
      this.spot.position.set(sp.x, this.waveH(sp.x, sp.z) + 0.45, sp.z);
      this.spot.scale.setScalar(0.8 + k * 1.1);
      this.spot.material.opacity = 1 - k * 0.8;
    }

    // Guide arrow: points to the destination (or the nearest island) until the visitor has docked once.
    const target: { x: number; z: number } | null = this.auto ?? this.nearest;
    const showArrow = this.controlsOn && !this.everDocked && !!target && !this.promptIsl;
    this.arrow.visible = showArrow;
    if (showArrow && target) {
      const dx = target.x - b.x, dz = target.z - b.z, d = Math.hypot(dx, dz) || 1;
      const off = 8.5 + Math.sin(T * 4) * 0.9 * this.ms;
      this.arrow.position.set(b.x + (dx / d) * off, 2.2 + Math.sin(T * 3) * 0.3 * this.ms, b.z + (dz / d) * off);
      this.arrow.rotation.y = Math.atan2(-dx, -dz);
      this.arrow.rotation.x = 0.5; // tip the face toward the camera
      this.arrow.scale.setScalar(1 + Math.sin(T * 6) * 0.12 * this.ms);
    }
  }
}
