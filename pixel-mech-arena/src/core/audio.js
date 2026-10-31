// WebAudio 芯片音效：全部用振荡器/噪声实时合成，零素材文件
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this._noiseBuffer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  get t() {
    return this.ctx.currentTime;
  }

  _noise() {
    if (!this._noiseBuffer) {
      const len = this.ctx.sampleRate * 0.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noiseBuffer = buf;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    return src;
  }

  /** 单个方波/三角波音符 */
  tone({ freq = 440, type = 'square', dur = 0.12, vol = 0.3, slide = 0, delay = 0, decay = 0.6 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * (1 + decay));
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur * (1 + decay) + 0.05);
  }

  /** 噪声打击音 */
  noise({ dur = 0.16, vol = 0.3, hp = 800, delay = 0 }) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime + delay;
    const src = this._noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---------- 具体音效 ----------
  swing() { this.noise({ dur: 0.1, vol: 0.12, hp: 2200 }); }

  hitLight() {
    this.noise({ dur: 0.12, vol: 0.28, hp: 700 });
    this.tone({ freq: 220, type: 'square', dur: 0.07, vol: 0.18, slide: -90 });
  }

  hitHeavy() {
    this.noise({ dur: 0.24, vol: 0.38, hp: 380 });
    this.tone({ freq: 130, type: 'sawtooth', dur: 0.18, vol: 0.28, slide: -70 });
  }

  block() {
    this.tone({ freq: 900, type: 'square', dur: 0.06, vol: 0.16, slide: 300 });
    this.noise({ dur: 0.08, vol: 0.14, hp: 3000 });
  }

  jump() { this.tone({ freq: 300, type: 'square', dur: 0.1, vol: 0.16, slide: 220 }); }

  land() { this.noise({ dur: 0.1, vol: 0.16, hp: 220 }); }

  special() {
    this.tone({ freq: 180, type: 'sawtooth', dur: 0.35, vol: 0.24, slide: 900 });
    this.tone({ freq: 90, type: 'square', dur: 0.4, vol: 0.18, slide: 400 });
    this.noise({ dur: 0.3, vol: 0.16, hp: 1200 });
  }

  ko() {
    this.noise({ dur: 0.5, vol: 0.34, hp: 260 });
    this.tone({ freq: 520, type: 'square', dur: 0.5, vol: 0.22, slide: -420 });
    this.tone({ freq: 260, type: 'square', dur: 0.6, vol: 0.18, slide: -180, delay: 0.08 });
  }

  ui() { this.tone({ freq: 660, type: 'square', dur: 0.06, vol: 0.14 }); }

  roundStart() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, type: 'square', dur: 0.16, vol: 0.2, delay: i * 0.11 }));
  }
}
