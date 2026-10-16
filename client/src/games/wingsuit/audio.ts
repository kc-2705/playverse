/** Wingsuit Canyon sounds, made with Web Audio so there are no sound files to load. */
export class WingsuitAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private wind: { gain: GainNode; filter: BiquadFilterNode; src: AudioBufferSourceNode } | null = null;

  private get audio() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number, delay = 0) {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBuffer(ctx: AudioContext, seconds: number) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Rushing wind that gets louder and brighter with speed. */
  startWind() {
    const ctx = this.audio;
    if (!ctx || !this.master || this.wind) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 2);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.wind = { gain, filter, src };
  }

  setSpeed(speed: number, near: boolean) {
    if (!this.wind || !this.ctx) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.max(0, (speed - 20) / 70));
    this.wind.gain.gain.setTargetAtTime(0.04 + k * 0.22 + (near ? 0.08 : 0), t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(300 + k * 1400 + (near ? 600 : 0), t, 0.1);
  }

  stopWind() {
    this.wind?.src.stop();
    this.wind = null;
  }

  ring = () => [880, 1320].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.1, undefined, i * 0.06));
  closeCall = () => this.tone(300, 0.35, 'sawtooth', 0.04, 900);
  arch = () => [523, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, undefined, i * 0.08));
  crash = () => {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, 0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.tone(90, 0.5, 'sine', 0.3, 40);
  };

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopWind();
  }

  dispose() {
    this.stopWind();
    void this.ctx?.close();
    this.ctx = null;
  }
}
