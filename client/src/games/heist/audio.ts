/** Night Heist sounds, made with Web Audio so there are no sound files to load. */
export class HeistAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private ambience: { stop: () => void } | null = null;
  private siren: number | null = null;

  private get audio() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0) {
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

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.audio;
    if (!ctx || !this.master) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  step = (run: boolean) => this.noise(run ? 0.07 : 0.05, run ? 0.22 : 0.05, run ? 900 : 500);
  gem = () => [1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.08, undefined, i * 0.07));
  throwCoin = () => this.noise(0.12, 0.08, 2500, 'bandpass');
  coinLand = () => {
    this.tone(2400, 0.18, 'square', 0.03);
    this.tone(3100, 0.25, 'sine', 0.05, undefined, 0.04);
  };
  cut = () => this.noise(0.18, 0.12, 3000, 'highpass');
  stolen = () => [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, undefined, i * 0.09));
  suspicious = () => this.tone(520, 0.22, 'sine', 0.09, 760);
  laserOn = () => this.tone(1800, 0.06, 'square', 0.012);
  escaped = () => [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.09, undefined, i * 0.1));

  caught = () => {
    this.tone(220, 0.5, 'sawtooth', 0.12, 110);
    const ctx = this.audio;
    if (!ctx) return;
    let hi = true;
    this.stopSiren();
    this.siren = window.setInterval(() => {
      this.tone(hi ? 880 : 660, 0.32, 'square', 0.05);
      hi = !hi;
    }, 340);
    window.setTimeout(() => this.stopSiren(), 3400);
  };

  stopSiren() {
    if (this.siren !== null) window.clearInterval(this.siren);
    this.siren = null;
  }

  /** A low, tense drone with a slow heartbeat. */
  startAmbience() {
    const ctx = this.audio;
    if (!ctx || !this.master || this.ambience) return;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);
    const oscs = [55, 82.4, 110.3].map((f) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    const beat = window.setInterval(() => {
      this.tone(60, 0.18, 'sine', 0.12);
      this.tone(52, 0.2, 'sine', 0.09, undefined, 0.22);
    }, 1600);
    this.ambience = {
      stop: () => {
        oscs.forEach((o) => o.stop());
        g.disconnect();
        window.clearInterval(beat);
      },
    };
  }

  stopAmbience() {
    this.ambience?.stop();
    this.ambience = null;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.stopAmbience();
      this.stopSiren();
    }
  }

  dispose() {
    this.stopAmbience();
    this.stopSiren();
    void this.ctx?.close();
    this.ctx = null;
  }
}
