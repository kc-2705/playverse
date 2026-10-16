/** Game sounds made with Web Audio, so there are no sound files to load. */
export class RunnerAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: number | null = null;
  private step = 0;
  private enabled = true;

  private get audio() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number) {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number) {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  coin = () => {
    this.tone(1320, 0.08, 'square', 0.05);
    setTimeout(() => this.tone(1760, 0.12, 'square', 0.045), 50);
  };
  jump = () => this.tone(260, 0.2, 'triangle', 0.16, 620);
  slide = () => this.noise(0.32, 0.22, 1100);
  lane = () => this.tone(500, 0.05, 'sine', 0.05, 620);
  land = () => this.noise(0.12, 0.35, 400);
  climb = () => {
    this.noise(0.1, 0.3, 700);
    this.tone(330, 0.12, 'triangle', 0.1, 520);
  };
  crash = () => {
    this.noise(0.7, 0.9, 520);
    this.tone(130, 0.55, 'sawtooth', 0.22, 45);
  };

  start() {
    this.startMusic();
  }

  /** A driving pulse that loops while running. */
  startMusic() {
    this.stopMusic();
    const bass = [110, 110, 98, 82.4];
    const lead = [440, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];
    this.music = window.setInterval(() => {
      if (!this.enabled) return;
      const bar = Math.floor(this.step / 8) % 4;
      if (this.step % 2 === 0) this.tone(bass[bar], 0.18, 'triangle', 0.09);
      if (this.step % 4 === 2) this.noise(0.05, 0.12, 6000);
      if (Math.random() < 0.45) this.tone(lead[(this.step + bar) % lead.length] / 2, 0.16, 'sine', 0.035);
      this.step++;
    }, 150);
  }

  stopMusic() {
    if (this.music) window.clearInterval(this.music);
    this.music = null;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
  }
}
