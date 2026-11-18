// Tiny WebAudio synth: one beep per event, no audio files.
export function makeAudio() {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('solmar-muted') === '1'; } catch (e) { /* private mode */ }

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    } catch (e) { /* audio is best-effort */ }
  }

  const sounds = {
    click() { tone(660, 0.07, 'square', 0.06); },
    cash() { tone(880, 0.12, 'sine', 0.14); setTimeout(() => tone(1320, 0.16, 'sine', 0.14), 90); },
    siren() { tone(700, 0.5, 'sawtooth', 0.05, 1100); },
    crash() { tone(120, 0.25, 'sawtooth', 0.16, 50); },
    horn() { tone(370, 0.18, 'square', 0.1); },
    heal() { tone(520, 0.2, 'sine', 0.12, 780); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.14), i * 130)); },
    lose() { [400, 300, 200].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.08), i * 160)); },
    engine() { tone(90, 0.12, 'sawtooth', 0.05, 140); },
    step() { tone(180, 0.04, 'sine', 0.03); },
  };

  return {
    sounds,
    isMuted() { return muted; },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem('solmar-muted', muted ? '1' : '0'); } catch (e) {}
    },
    toggleMuted() { this.setMuted(!muted); return muted; },
    unlock() { ensure(); },
  };
}
