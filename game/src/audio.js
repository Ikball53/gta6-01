// SOLMAR HEAT — sound: every effect is synthesized with WebAudio.
// No audio files, no network. Mute with M or the mute button.

export function makeAudio() {
  const A = {
    ctx: null, muted: false, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenT: 0, sirenHigh: false,
    ensure() {
      if (!A.ctx) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          A.ctx = new Ctx();
        } catch (e) { A.ctx = null; }
      }
      if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
      return A.ctx;
    },
    tone(freq, dur, type, vol, slideTo, delay) {
      if (A.muted || !A.ensure()) return;
      const t0 = A.ctx.currentTime + (delay || 0);
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(A.ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    noise(dur, vol, filterFreq) {
      if (A.muted || !A.ensure()) return;
      const t0 = A.ctx.currentTime;
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource();
      src.buffer = buf;
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const g = A.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(A.ctx.destination);
      src.start(t0);
    },
    sfx(name) {
      if (A.muted) return;
      switch (name) {
        case 'shot': A.noise(0.12, 0.35, 3000); A.tone(180, 0.1, 'square', 0.12, 60); break;
        case 'punch': A.noise(0.08, 0.2, 900); break;
        case 'pickup': A.tone(660, 0.08, 'sine', 0.15); A.tone(880, 0.12, 'sine', 0.15, null, 0.07); break;
        case 'cash': A.tone(880, 0.08, 'triangle', 0.16); A.tone(1174, 0.08, 'triangle', 0.16, null, 0.08); A.tone(1568, 0.14, 'triangle', 0.16, null, 0.16); break;
        case 'mission': A.tone(523, 0.1, 'triangle', 0.16); A.tone(659, 0.1, 'triangle', 0.16, null, 0.1); A.tone(784, 0.18, 'triangle', 0.16, null, 0.2); break;
        case 'wanted': A.tone(700, 0.25, 'sawtooth', 0.08, 950); A.tone(950, 0.25, 'sawtooth', 0.08, 700, 0.25); break;
        case 'busted': A.tone(392, 0.2, 'sawtooth', 0.12, 300); A.tone(311, 0.3, 'sawtooth', 0.12, 220, 0.2); break;
        case 'wasted': A.tone(330, 0.3, 'sawtooth', 0.12, 196); A.tone(196, 0.5, 'sawtooth', 0.12, 130, 0.3); break;
        case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => A.tone(f, 0.16, 'triangle', 0.16, null, i * 0.12)); break;
        case 'fail': A.tone(220, 0.35, 'sawtooth', 0.1, 160); break;
        case 'door': A.noise(0.06, 0.15, 500); A.tone(120, 0.08, 'sine', 0.12, 70); break;
        case 'crash': A.noise(0.25, 0.3, 700); break;
        case 'horn': A.tone(330, 0.18, 'square', 0.08); A.tone(415, 0.18, 'square', 0.06); break;
        case 'hurt': A.tone(200, 0.15, 'sawtooth', 0.12, 90); break;
        case 'empty': A.tone(1200, 0.05, 'square', 0.08); break;
        case 'click': A.tone(900, 0.05, 'sine', 0.1); break;
        default: break;
      }
    },
    setEngine(on, speed) {
      if (!A.ensure()) return;
      if (on && !A.engineOsc) {
        A.engineOsc = A.ctx.createOscillator();
        A.engineGain = A.ctx.createGain();
        A.engineOsc.type = 'sawtooth';
        A.engineOsc.frequency.value = 60;
        A.engineGain.gain.value = 0.0;
        const f = A.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        A.engineOsc.connect(f);
        f.connect(A.engineGain);
        A.engineGain.connect(A.ctx.destination);
        A.engineOsc.start();
      }
      if (A.engineOsc) {
        const target = A.muted ? 0 : (on ? 0.05 : 0);
        A.engineGain.gain.setTargetAtTime(target, A.ctx.currentTime, 0.1);
        A.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed || 0) * 0.22, A.ctx.currentTime, 0.08);
      }
    },
    update(dt, wanted, playerInCar) {
      if (!A.ensure()) return;
      if (wanted > 0 && !A.muted) {
        if (!A.sirenOsc) {
          A.sirenOsc = A.ctx.createOscillator();
          A.sirenGain = A.ctx.createGain();
          A.sirenOsc.type = 'triangle';
          A.sirenOsc.frequency.value = 750;
          A.sirenGain.gain.value = 0.035;
          A.sirenOsc.connect(A.sirenGain);
          A.sirenGain.connect(A.ctx.destination);
          A.sirenOsc.start();
        }
        A.sirenT += dt;
        if (A.sirenT > 0.45) {
          A.sirenT = 0;
          A.sirenHigh = !A.sirenHigh;
          A.sirenOsc.frequency.setTargetAtTime(A.sirenHigh ? 950 : 700, A.ctx.currentTime, 0.05);
        }
      } else if (A.sirenOsc) {
        try { A.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        A.sirenOsc = null;
        A.sirenGain = null;
      }
      const v = playerInCar && playerInCar.speed !== undefined ? playerInCar : null;
      A.setEngine(!!v, v ? v.speed : 0);
    },
    setMuted(m) {
      A.muted = m;
      if (A.engineGain && A.ctx) A.engineGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.05);
      if (A.sirenGain && A.ctx) A.sirenGain.gain.setTargetAtTime(0, A.ctx.currentTime, 0.05);
      try { localStorage.setItem('solmar-heat-muted', m ? '1' : '0'); } catch (e) { /* no storage */ }
    },
    loadMuted() {
      try { A.muted = localStorage.getItem('solmar-heat-muted') === '1'; } catch (e) { A.muted = false; }
      return A.muted;
    },
  };
  return A;
}
