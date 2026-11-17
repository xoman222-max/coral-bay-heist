// All sound is synthesised with WebAudio — no audio files, no network.
// Engine hum, two-tone siren, gunshot noise, pickup blip, mission jingle and a
// slow sunset pad loop. Everything is guarded so the game still runs muted or
// before the first user gesture (AudioContext starts on first interaction).
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let padNodes = null;
  let musicOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, lowFreq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(t);
    } catch { /* ignore */ }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch { engineOsc = null; }
  }

  function startPad() {
    if (!ensure() || padNodes || musicOn) return;
    musicOn = true;
    try {
      // Slow chord pad: two detuned triangles through a lowpass, gently swaying.
      const freqs = [110, 164.8, 220, 277.2];
      const g = ctx.createGain();
      g.gain.value = 0.05;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      filter.connect(g);
      g.connect(master);
      const oscs = freqs.map((f) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.connect(filter);
        o.start();
        return o;
      });
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      lfo.start();
      padNodes = { oscs, g, lfo };
    } catch { padNodes = null; }
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
      if (value && sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() { return muted; },
    startEngine,
    startMusic: startPad,
    setEngine(speedNorm, driving) {
      if (!engineOsc || !engineGain || muted) return;
      const target = driving ? 0.05 + speedNorm * 0.09 : 0.015;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(50 + speedNorm * 130, ctx.currentTime, 0.08);
    },
    gunshot() { noise(0.16, 0.5, 2400); tone(160, 0.1, 'square', 0.18, 60); },
    punch() { noise(0.08, 0.25, 900); },
    crash() { noise(0.35, 0.45, 700); tone(70, 0.25, 'sine', 0.3, 40); },
    pickup() { tone(660, 0.09, 'sine', 0.22); setTimeout(() => tone(990, 0.14, 'sine', 0.22), 80); },
    denied() { tone(180, 0.15, 'square', 0.15, 120); },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        try {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 700;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = muted ? 0 : 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenTimer = 0;
        } catch { sirenOsc = null; }
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch { /* ignore */ }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    updateSiren(dt) {
      if (sirenOsc && !muted) {
        sirenTimer += dt;
        // Classic two-tone wail: 700 Hz then 950 Hz, alternating.
        const f = Math.floor(sirenTimer / 0.45) % 2 === 0 ? 700 : 950;
        sirenOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      }
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110));
    },
    fail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.16), i * 160));
    },
    arrest() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
  };
}
