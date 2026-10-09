/* Optional sound, synthesised with Web Audio (no audio files to download).
   Nothing is created until the visitor turns sound on, so audio never autoplays. */

export class Sfx {
  on = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Flip sound on or off. Returns the new state. */
  toggle(): boolean {
    if (!this.ctx) this.init();
    if (!this.ctx || !this.master) return false;
    this.on = !this.on;
    if (this.on) void this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.08);
    return this.on;
  }

  private init() {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Soft waves: looping filtered noise whose volume swells slowly.
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 480;
    const swell = ctx.createGain();
    swell.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const depth = ctx.createGain();
    depth.gain.value = 0.09;
    lfo.connect(depth); depth.connect(swell.gain);
    src.connect(lp); lp.connect(swell); swell.connect(master);
    src.start(); lfo.start();

    this.ctx = ctx; this.master = master; this.noise = noise;
  }

  splash(strength = 1) {
    if (!this.on || !this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * Math.min(1, strength), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t, Math.random()); src.stop(t + 0.4);
  }

  private tone(freq: number, at: number, dur: number, vol: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + at;
    const o = this.ctx.createOscillator();
    o.type = "triangle"; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  click() { if (this.on) this.tone(720, 0, 0.09, 0.22); }

  chime() {
    if (!this.on) return;
    this.tone(523, 0, 0.3, 0.2);
    this.tone(784, 0.1, 0.4, 0.2);
  }
}
