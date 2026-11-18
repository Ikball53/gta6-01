// WebAudio sound effects for SOLMAR HEAT, all synthesized — no audio files.
// Every call is guarded so a missing AudioContext (headless, muted tab)
// can never throw into the game loop.
export function createSfx() {
  const S = {
    muted: false,
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
  };

  S.ensure = () => {
    try {
      // A hidden tab cannot start audio anyway; wait for a visible gesture.
      if (typeof document !== 'undefined' && document.hidden) return false;
      if (!S.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        S.ctx = new AC();
        S.master = S.ctx.createGain();
        S.master.gain.value = 0.5;
        S.master.connect(S.ctx.destination);
      }
      if (S.ctx.state === 'suspended') S.ctx.resume().catch(() => {});
      return true;
    } catch (e) { return false; }
  };
  S.toggleMute = () => {
    S.muted = !S.muted;
    try { if (S.master) S.master.gain.value = S.muted ? 0 : 0.5; } catch (e) {}
    return S.muted;
  };
  const tone = (freq, dur, type, vol, slideTo) => {
    if (S.muted || !S.ensure()) return;
    try {
      const t = S.ctx.currentTime;
      const o = S.ctx.createOscillator();
      const g = S.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(S.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  };
  const noise = (dur, vol, low) => {
    if (S.muted || !S.ensure()) return;
    try {
      const t = S.ctx.currentTime;
      const len = Math.max(1, Math.floor(S.ctx.sampleRate * dur));
      const buf = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = S.ctx.createBufferSource();
      src.buffer = buf;
      const f = S.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = low || 1200;
      const g = S.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(S.master);
      src.start(t);
    } catch (e) {}
  };

  S.shot = () => { noise(0.12, 0.5, 2800); tone(180, 0.08, 'square', 0.18, 60); };
  S.punch = () => { noise(0.08, 0.3, 700); };
  S.pickup = () => { tone(660, 0.12, 'sine', 0.22); setTimeout(() => tone(990, 0.16, 'sine', 0.22), 90); };
  S.cash = () => { tone(880, 0.1, 'triangle', 0.2); setTimeout(() => tone(1174, 0.14, 'triangle', 0.2), 80); setTimeout(() => tone(1568, 0.2, 'triangle', 0.18), 160); };
  S.complete = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110)); };
  S.fail = () => { tone(220, 0.35, 'sawtooth', 0.16, 110); tone(165, 0.4, 'sawtooth', 0.12, 90); };
  S.crash = () => { noise(0.3, 0.5, 500); };
  S.honk = () => { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); };
  S.click = () => { tone(1200, 0.05, 'square', 0.1); };
  S.door = () => { noise(0.1, 0.2, 900); tone(140, 0.1, 'sine', 0.15, 90); };
  S.siren = (on) => {
    if (S.muted || !S.ensure()) { S.sirenOn = false; return; }
    try {
      if (on && !S.sirenOn) {
        S.sirenOn = true;
        S.sirenOsc = S.ctx.createOscillator();
        S.sirenOsc.type = 'sine';
        S.sirenGain = S.ctx.createGain();
        S.sirenGain.gain.value = 0.045;
        const lfo = S.ctx.createOscillator();
        lfo.frequency.value = 0.6;
        const lg = S.ctx.createGain(); lg.gain.value = 320;
        lfo.connect(lg); lg.connect(S.sirenOsc.frequency);
        S.sirenOsc.frequency.value = 820;
        S.sirenOsc.connect(S.sirenGain); S.sirenGain.connect(S.master);
        S.sirenOsc.start(); lfo.start();
        S._sirenLfo = lfo;
      } else if (!on && S.sirenOn) {
        S.sirenOn = false;
        try { S.sirenOsc.stop(); S._sirenLfo.stop(); } catch (e) {}
        S.sirenOsc = null; S._sirenLfo = null;
      }
    } catch (e) { S.sirenOn = false; }
  };
  // Continuous engine hum; speed 0..1. Call every frame while driving.
  S.engine = (speed) => {
    if (S.muted || !S.ensure()) return;
    try {
      if (!S.engineOsc) {
        S.engineOsc = S.ctx.createOscillator();
        S.engineOsc.type = 'sawtooth';
        S.engineGain = S.ctx.createGain();
        S.engineGain.gain.value = 0;
        const f = S.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 600;
        S.engineOsc.connect(f); f.connect(S.engineGain); S.engineGain.connect(S.master);
        S.engineOsc.start();
      }
      const target = speed > 0.02 ? 0.05 + speed * 0.06 : 0;
      S.engineGain.gain.setTargetAtTime(target, S.ctx.currentTime, 0.08);
      S.engineOsc.frequency.setTargetAtTime(55 + speed * 140, S.ctx.currentTime, 0.1);
    } catch (e) {}
  };
  S.engineOff = () => {
    try { if (S.engineGain) S.engineGain.gain.setTargetAtTime(0, S.ctx.currentTime, 0.05); } catch (e) {}
  };
  return S;
}
