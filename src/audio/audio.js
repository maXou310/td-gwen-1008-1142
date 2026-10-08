// audio.js — minimal WebAudio-synthesized audio (no files).
export const audio = (() => {
  let ctx = null;
  let settings = { muted: false, sfxVol: 0.8, musicVol: 0.6 };
  let musicNodes = null;
  let unlocked = false;

  function init(s) {
    settings = { ...settings, ...(s || {}) };
  }

  function unlock() {
    if (unlocked) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      unlocked = true;
    } catch { /* no audio */ }
  }

  function blip(freq, dur, type = 'square', vol = 1) {
    if (!ctx || settings.muted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0.12 * vol * settings.sfxVol;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function play(name, sub) {
    if (!ctx) return;
    switch (name) {
      case 'click': blip(600, 0.05, 'square'); break;
      case 'buy': blip(440, 0.08, 'triangle'); setTimeout(() => blip(660, 0.08, 'triangle'), 60); break;
      case 'sell': blip(330, 0.08, 'triangle'); break;
      case 'upgrade': blip(520, 0.07, 'sine'); setTimeout(() => blip(780, 0.09, 'sine'), 70); break;
      case 'shoot':
        if (sub === 'cannon') blip(120, 0.12, 'sawtooth', 0.8);
        else if (sub === 'sniper') blip(900, 0.06, 'square', 0.6);
        else blip(700, 0.05, 'square', 0.7);
        break;
      case 'hit': blip(200, 0.05, 'sawtooth', 0.5); break;
      case 'explode': blip(80, 0.2, 'sawtooth', 0.9); break;
      case 'slow': blip(1000, 0.08, 'sine', 0.4); break;
      case 'kill': blip(880, 0.06, 'triangle', 0.6); break;
      case 'leak': blip(150, 0.25, 'sawtooth', 0.8); break;
      case 'wave': blip(392, 0.1, 'triangle'); setTimeout(() => blip(523, 0.12, 'triangle'), 100); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.15, 'triangle'), i * 120)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'sawtooth'), i * 150)); break;
    }
  }

  // 4-note loop music stub.
  function startMusic() {
    if (!ctx || musicNodes) return;
    const notes = [220, 262, 330, 392];
    let step = 0;
    const g = ctx.createGain();
    g.gain.value = 0.05 * settings.musicVol;
    g.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = notes[0];
    o.connect(g);
    o.start();
    const iv = setInterval(() => {
      step = (step + 1) % notes.length;
      o.frequency.setTargetAtTime(notes[step], ctx.currentTime, 0.05);
    }, 500);
    musicNodes = { o, g, iv };
  }

  function stopMusic() {
    if (!musicNodes) return;
    clearInterval(musicNodes.iv);
    try { musicNodes.o.stop(); } catch {}
    musicNodes = null;
  }

  function setMuted(b) { settings.muted = !!b; }
  function setSfxVol(v) { settings.sfxVol = v; }
  function setMusicVol(v) { settings.musicVol = v; if (musicNodes) musicNodes.g.gain.value = 0.05 * v; }

  return {
    init, unlock, play, startMusic, stopMusic, setMuted, setSfxVol, setMusicVol,
    get _ctx() { return ctx; }
  };
})();
