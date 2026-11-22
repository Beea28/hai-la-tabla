// Efecte sonore generate pe loc (fara fisiere audio).
const SUNET = (() => {
  let ctx = null;
  let mut = false;
  try { mut = localStorage.getItem('hlt-mut') === '1'; } catch { /* nimic */ }

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function ton(f, d = 0.12, tip = 'sine', vol = 0.15, start = 0, fSfarsit = null) {
    if (mut) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tip;
    o.frequency.setValueAtTime(f, t0);
    if (fSfarsit) o.frequency.exponentialRampToValueAtTime(fSfarsit, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + d + 0.03);
  }

  return {
    deblocheaza: () => { ac(); },
    pas: (dir = 1) => ton(dir > 0 ? 680 : 340, 0.07, 'triangle', 0.13),
    zar: () => { for (let i = 0; i < 10; i++) ton(260 + Math.random() * 520, 0.04, 'square', 0.045, i * 0.1); },
    bun: () => [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.16, 'triangle', 0.14, i * 0.08)),
    rau: () => ton(440, 0.55, 'sawtooth', 0.07, 0, 110),
    bip: () => ton(880, 0.12, 'sine', 0.18),
    start: () => ton(1320, 0.35, 'sine', 0.2),
    pop: () => { ton(160, 0.2, 'square', 0.22, 0, 40); ton(90, 0.25, 'sawtooth', 0.12, 0.02, 30); },
    nota: (i) => ton([392, 523, 659, 784][i] || 440, 0.38, 'triangle', 0.2),
    carte: () => [660, 880].forEach((f, i) => ton(f, 0.12, 'sine', 0.12, i * 0.09)),
    intrare: () => [392, 523, 659].forEach((f, i) => ton(f, 0.12, 'triangle', 0.12, i * 0.07)),
    reactie: () => ton(1200 + Math.random() * 400, 0.06, 'sine', 0.05),
    minijoc: () => [523, 659, 784, 659, 1047].forEach((f, i) => ton(f, 0.14, 'square', 0.06, i * 0.1)),
    fanfara: () => [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => ton(f, 0.24, 'triangle', 0.17, i * 0.15)),
    get mut() { return mut; },
    set mut(v) {
      mut = !!v;
      try { localStorage.setItem('hlt-mut', mut ? '1' : '0'); } catch { /* nimic */ }
    },
  };
})();
