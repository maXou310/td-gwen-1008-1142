// audio.js — WebAudio-synthesized SFX + ambient music (no audio files).
// Isomorphic: importable in node (no window/AudioContext) without throwing.

// A minor pentatonic: A C D E G (Hz, octave 4 base).
const PENTA = [220.0, 261.63, 293.66, 329.63, 392.0];

// Seeded PRNG (mulberry32) — deterministic per seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 16s melody over the pentatonic scale (~70 BPM feel).
// Returns [{note: Hz, time: seconds}] sorted by time.
export function buildMelody(seed) {
  const rnd = mulberry32(seed);
  const events = [];
  // ~70 BPM -> eighth note ≈ 0.428s. 16s ≈ 37 steps.
  const step = 60 / 70 / 2;
  const nSteps = Math.round(16 / step);
  let deg = 2; // start on D
  for (let i = 0; i < nSteps; i++) {
    // random walk on the scale, occasional rest
    if (rnd() > 0.25) {
      deg += Math.floor(rnd() * 5) - 2;
      deg = ((deg % 5) + 5) % 5;
      const oct = rnd() < 0.2 ? 2 : 1;
      events.push({ note: PENTA[deg] * oct, time: +(i * step).toFixed(4) });
    }
  }
  return events;
}

// Static spec table: name -> {freq, dur, kind}. `shoot` uses sub specs.
// Used by tests and as documentation of every synthesized voice.
export const SYNTH_SPECS = {
  click:   { freq: 800,  dur: 0.012, kind: 'square' },
  buy:     { freq: 750,  dur: 0.12,  kind: 'triangle' }, // rising 600->900
  sell:    { freq: 700,  dur: 0.12,  kind: 'triangle' }, // falling 900->500
  upgrade: { freq: 700,  dur: 0.18,  kind: 'triangle' }, // arpeggio 500/700/900
  shoot:   { freq: 2000, dur: 0.04,  kind: 'square' },   // default sub = arrow
  hit:     { freq: 200,  dur: 0.06,  kind: 'noise' },
  explode: { freq: 450,  dur: 0.3,   kind: 'noise' },    // lowpass sweep 800->100 + 60Hz sub
  slow:    { freq: 900,  dur: 0.2,   kind: 'sine' },     // 1200->600 quiet
  kill:    { freq: 900,  dur: 0.09,  kind: 'triangle' }, // pop
  leak:    { freq: 330,  dur: 0.3,   kind: 'sawtooth' }, // 440->220
  wave:    { freq: 653,  dur: 0.25,  kind: 'triangle' }, // 523/784
  win:     { freq: 659,  dur: 0.5,   kind: 'triangle' }, // major arpeggio
  lose:    { freq: 330,  dur: 0.6,   kind: 'sawtooth' }, // falling minor
};

const SHOOT_SUBS = {
  arrow:   { freq: 2000, dur: 0.04, kind: 'square' },
  cannon:  { freq: 80,   dur: 0.08, kind: 'sine' },
  frost:   { freq: 1400, dur: 0.09, kind: 'sine' },
  support: { freq: 1000, dur: 0.07, kind: 'triangle' },
  sniper:  { freq: 3000, dur: 0.06, kind: 'noise' },
};

export const audio = (() => {
  let ctx = null;
  let noiseBuf = null;          // 1s white-noise buffer, created once at unlock
  let masterGain = null;       // muted?0:1
  let sfxGain = null;          // sfxVol
  let musicGain = null;        // musicVol
  let settings = { muted: false, sfxVol: 0.8, musicVol: 0.6 };
  let unlocked = false;
  let musicTimer = null;
  let musicNextTime = 0;
  let musicIdx = 0;
  let padStep = 0;
  const lastPlay = {};         // rate-limit timestamps (ms, perf.now-ish)

  function nowMs() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

  function init(s) {
    settings = { ...settings, ...(s || {}) };
    settings.muted = !!settings.muted;
    settings.sfxVol = clamp01(settings.sfxVol ?? 0.8);
    settings.musicVol = clamp01(settings.musicVol ?? 0.6);
  }

  function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }

  function unlock() {
    if (unlocked) { resumeIfSuspended(); return; }
    try {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return;
      ctx = new AC();
      // 1s white-noise buffer, created once.
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      masterGain = ctx.createGain();
      masterGain.gain.value = settings.muted ? 0 : 1;
      masterGain.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = settings.sfxVol;
      sfxGain.connect(masterGain);
      musicGain = ctx.createGain();
      musicGain.gain.value = settings.musicVol;
      musicGain.connect(masterGain);
      unlocked = true;
      resumeIfSuspended();
    } catch { /* no audio available */ }
  }

  function resumeIfSuspended() {
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch {}
    }
  }

  // ---- primitive voices ---------------------------------------------------
  function osc(type, freqAt, dur, vol, when, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    if (typeof freqAt === 'number') o.frequency.setValueAtTime(freqAt, when);
    else freqAt.forEach(([t, f]) => o.frequency.linearRampToValueAtTime(f, when + t));
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(when);
    o.stop(when + dur + 0.02);
    return o;
  }

  function noise(dur, vol, when, opts = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    let node = src;
    if (opts.filterFreq != null) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(opts.filterFreq, when);
      if (opts.filterEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.filterEnd), when + dur);
      node.connect(f); node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    node.connect(g); g.connect(sfxGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  // ---- SFX ------------------------------------------------------------------
  const SFX = {
    click() { osc('square', 800, 0.012, 0.5); },
    buy() { osc('triangle', [[0, 600], [0.12, 900]], 0.12, 0.7); },
    sell() { osc('triangle', [[0, 900], [0.12, 500]], 0.12, 0.6); },
    upgrade() {
      [500, 700, 900].forEach((f, i) => osc('triangle', f, 0.06, 0.6, ctx.currentTime + i * 0.06));
    },
    shoot(sub) {
      const s = SHOOT_SUBS[sub] || SHOOT_SUBS.arrow;
      const t = ctx.currentTime;
      switch (sub) {
        case 'cannon':
          osc('sine', 80, 0.08, 0.9, t);
          noise(0.08, 0.35, t, { filterFreq: 500 });
          break;
        case 'frost': {
          const o = osc('sine', 1400, 0.09, 0.4, t);
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 30;
          const lg = ctx.createGain();
          lg.gain.value = 40;
          lfo.connect(lg); lg.connect(o.frequency);
          lfo.start(t); lfo.stop(t + 0.09);
          break;
        }
        case 'support':
          osc('triangle', 1000, 0.07, 0.5, t);
          break;
        case 'sniper':
          noise(0.03, 0.5, t, { filterFreq: 4000 });
          osc('sine', 3000, 0.04, 0.35, t + 0.02);
          break;
        default: // arrow tick
          osc('square', 2000, 0.04, 0.3, t);
      }
    },
    hit() {
      const t = ctx.currentTime;
      noise(0.06, 0.4, t, { filterFreq: 1200 });
      osc('sine', 200, 0.06, 0.5, t);
    },
    explode() {
      const t = ctx.currentTime;
      noise(0.3, 0.8, t, { filterFreq: 800, filterEnd: 100 });
      osc('sine', 60, 0.3, 0.9, t);
    },
    slow() { osc('sine', [[0, 1200], [0.2, 600]], 0.2, 0.25); },
    kill() { osc('triangle', [[0, 1200], [0.09, 400]], 0.09, 0.5); },
    leak() { osc('sawtooth', [[0, 440], [0.3, 220]], 0.3, 0.5); },
    wave() {
      osc('triangle', 523.25, 0.12, 0.6);
      osc('triangle', 783.99, 0.13, 0.6, ctx.currentTime + 0.12);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        osc('triangle', f, 0.14, 0.6, ctx.currentTime + i * 0.12));
    },
    lose() {
      [440, 349.23, 261.63].forEach((f, i) =>
        osc('sawtooth', f, 0.2, 0.45, ctx.currentTime + i * 0.2));
    },
  };

  // Rate limits: shoot/hit max once per 50ms; kill/leak/wave always play.
  const RATE_LIMITED = { shoot: 50, hit: 50 };

  function play(name, sub) {
    if (!ctx || !unlocked) return;
    if (settings.muted) return;
    const key = name === 'shoot' ? 'shoot:' + (sub || 'arrow') : name;
    const minGap = RATE_LIMITED[name];
    if (minGap) {
      const t = nowMs();
      if (lastPlay[key] && t - lastPlay[key] < minGap) return;
      lastPlay[key] = t;
    }
    try {
      const fn = SFX[name];
      if (fn) fn(sub);
    } catch { /* never break the game over audio */ }
  }

  // ---- music: lookahead scheduler ------------------------------------------
  const PAD_ROOTS = [PENTA[0] / 2, PENTA[3] / 2, PENTA[1] / 2, PENTA[4] / 2]; // A2 E2 C3 G2
  const MELODY_LEN = 16; // seconds

  let melodyCache = null;

  function scheduleMusic() {
    if (!musicTimer) return;
    if (!melodyCache) melodyCache = buildMelody(1);
    while (musicNextTime < ctx.currentTime + 0.1) {
      const off = musicNextTime - ctx.currentTime;
      // pluck melody (triangle, short decay)
      const ev = melodyCache[musicIdx % melodyCache.length];
      if (ev) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = ev.note;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, musicNextTime);
        g.gain.exponentialRampToValueAtTime(0.0001, musicNextTime + 0.35);
        o.connect(g); g.connect(musicGain);
        o.start(musicNextTime);
        o.stop(musicNextTime + 0.4);
      }
      musicIdx++;
      // low pad: 2 detuned sawtooths through lowpass 400Hz, whole notes (4 beats @70bpm ≈ 3.43s)
      if (off <= 0.12 && padStep % 8 === 0) {
        const root = PAD_ROOTS[(padStep / 8) % PAD_ROOTS.length];
        [-6, 6].forEach((cents) => {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = root * Math.pow(2, cents / 1200);
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 400;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, musicNextTime);
          g.gain.linearRampToValueAtTime(0.25, musicNextTime + 0.4);
          g.gain.setValueAtTime(0.25, musicNextTime + 2.8);
          g.gain.linearRampToValueAtTime(0.0001, musicNextTime + 3.4);
          o.connect(f); f.connect(g); g.connect(musicGain);
          o.start(musicNextTime);
          o.stop(musicNextTime + 3.5);
        });
        padStep++;
      }
      musicNextTime += 60 / 70 / 2; // eighth-note grid
    }
  }

  function startMusic() {
    if (!ctx || !unlocked || musicTimer) return;
    musicNextTime = ctx.currentTime + 0.05;
    musicIdx = 0;
    padStep = 0;
    musicTimer = setInterval(scheduleMusic, 25);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  // ---- volume / mute (live updates) ----------------------------------------
  function setMuted(b) {
    settings.muted = !!b;
    if (masterGain) masterGain.gain.value = settings.muted ? 0 : 1;
  }
  function setSfxVol(v) {
    settings.sfxVol = clamp01(v);
    if (sfxGain) sfxGain.gain.value = settings.sfxVol;
  }
  function setMusicVol(v) {
    settings.musicVol = clamp01(v);
    if (musicGain) musicGain.gain.value = settings.musicVol;
  }

  // Test hooks (pure/static, safe in node).
  const _test = {
    synthSpecs: SYNTH_SPECS,
    shootSubs: SHOOT_SUBS,
    penta: PENTA,
    buildMelody,
    isMuted: () => settings.muted,
  };

  return {
    init, unlock, play, startMusic, stopMusic,
    setMuted, setSfxVol, setMusicVol,
    get _ctx() { return ctx; },
    _test,
  };
})();

// Browser-only introspection handle.
if (typeof window !== 'undefined') {
  window.__audio = {
    isUnlocked: () => audio._ctx != null,
    getMuted: () => audio._test.isMuted(),
  };
}
