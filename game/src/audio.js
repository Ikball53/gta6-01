// SOLMAR HEAT — sound. Every effect is a WebAudio oscillator or filtered
// noise, made at run time: no audio files, no network, nothing to load.
// One mute switch (M key or the mute button) silences all of it.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.sirenGain) this.sirenGain.gain.value = 0;
  }

  // A short tone: frequency, seconds, shape, volume.
  tone(freq, dur, type, vol, slideTo) {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  click() { this.tone(660, 0.07, 'square', 0.06); }
  chime() { this.tone(880, 0.12, 'sine', 0.12); setTimeout(() => this.tone(1318, 0.18, 'sine', 0.12), 110); }
  paid() {
    this.tone(523, 0.12, 'triangle', 0.14);
    setTimeout(() => this.tone(659, 0.12, 'triangle', 0.14), 110);
    setTimeout(() => this.tone(784, 0.22, 'triangle', 0.14), 220);
  }
  bump() {
    if (this.muted || !this.ensure()) return;
    const t = this.ctx.currentTime;
    const len = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(g).connect(this.ctx.destination);
    src.start(t);
  }
  punch() { this.tone(180, 0.09, 'square', 0.14, 90); }

  // A low engine hum that follows the car's speed; call every frame.
  engineHum(speedNorm, driving) {
    if (this.muted) { if (this.engineGain) this.engineGain.gain.value = 0; return; }
    if (!this.ensure()) return;
    if (!this.engine) {
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engine.connect(filt).connect(this.engineGain).connect(this.ctx.destination);
      this.engine.start();
    }
    const target = driving ? 0.03 + speedNorm * 0.05 : 0;
    this.engine.frequency.value = 55 + speedNorm * 90;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  // Two-tone police siren while any wanted level is active.
  siren(on) {
    if (!this.ensure()) return;
    if (!on) {
      if (this.sirenGain) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (this.muted) return;
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      let high = false;
      this.sirenOsc._timer = setInterval(() => {
        if (!this.sirenOsc) return;
        high = !high;
        this.sirenOsc.frequency.value = high ? 780 : 590;
      }, 420);
    }
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
  }
}
