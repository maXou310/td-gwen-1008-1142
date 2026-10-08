// audio.test.js — node --test: isomorphic import, synth spec table, pentatonic scale, melody determinism.
import test from 'node:test';
import assert from 'node:assert/strict';
import { audio, buildMelody, SYNTH_SPECS } from '../src/audio/audio.js';

const SFX_NAMES = ['click', 'buy', 'sell', 'upgrade', 'shoot', 'hit', 'explode', 'slow', 'kill', 'leak', 'wave', 'win', 'lose'];

test('module imports in node without window/AudioContext (no throw)', () => {
  assert.ok(audio);
  assert.equal(typeof audio.play, 'function');
  // _ctx null before unlock
  assert.equal(audio._ctx, null);
});

test('audio._test.synthSpecs exposes the static spec table for all 13 SFX names', () => {
  const specs = audio._test.synthSpecs;
  assert.deepEqual(Object.keys(specs).sort(), [...SFX_NAMES].sort());
  assert.deepEqual(specs, SYNTH_SPECS);
});

test('all SFX specs: freqs 40..4000Hz, durs 0.03..0.8s, valid kind', () => {
  const kinds = new Set(['square', 'triangle', 'sine', 'sawtooth', 'noise']);
  for (const name of SFX_NAMES) {
    const s = SYNTH_SPECS[name];
    assert.ok(s, `missing spec for ${name}`);
    assert.ok(s.freq >= 40 && s.freq <= 4000, `${name} freq ${s.freq} out of range`);
    // click is a 12ms tick per spec; everything else 0.03..0.8s
    const minDur = name === 'click' ? 0.008 : 0.03;
    assert.ok(s.dur >= minDur && s.dur <= 0.8, `${name} dur ${s.dur} out of range`);
    assert.ok(kinds.has(s.kind), `${name} bad kind ${s.kind}`);
  }
});

test('pentatonic scale has exactly 5 notes (A minor: A C D E G)', () => {
  const penta = audio._test.penta;
  assert.equal(penta.length, 5);
  // A4 C4 D4 E4 G4
  assert.ok(Math.abs(penta[0] - 220.0) < 0.01);
  assert.ok(Math.abs(penta[1] - 261.63) < 0.01);
  assert.ok(Math.abs(penta[2] - 293.66) < 0.01);
  assert.ok(Math.abs(penta[3] - 329.63) < 0.01);
  assert.ok(Math.abs(penta[4] - 392.0) < 0.01);
});

test('buildMelody(42) is deterministic and spans ~16s', () => {
  const a = buildMelody(42);
  const b = buildMelody(42);
  assert.deepEqual(a, b);
  assert.ok(Array.isArray(a) && a.length > 0);
  for (const ev of a) {
    assert.ok(ev.note > 0 && Number.isFinite(ev.time));
  }
  const last = a[a.length - 1];
  assert.ok(last.time >= 15 && last.time <= 16.5, `melody span ${last.time}s not ~16s`);
  // different seed -> different sequence
  assert.notDeepEqual(buildMelody(42), buildMelody(43));
});

test('volume/mute setters are safe before unlock (no crash)', () => {
  audio.init({ muted: true, sfxVol: 0.5, musicVol: 0.3 });
  audio.setMuted(false);
  audio.setSfxVol(0.7);
  audio.setMusicVol(0.9);
  audio.play('click');       // no ctx yet -> silent, no throw
  audio.play('shoot', 'cannon');
  audio.startMusic();        // no ctx -> no-op
  audio.stopMusic();
  assert.equal(audio._ctx, null);
});

test('play() with every name+sub does not throw once unlocked (mock AudioContext)', () => {
  // Minimal mock so unlock() succeeds in node.
  class MockNode {
    constructor() { this.gain = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }; }
    connect() { return this; }
    start() {} stop() {}
  }
  const MockCtx = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    createOscillator() { return Object.assign(new MockNode(), { type: 'sine', frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect(t) { return t; }, start() {}, stop() {} }); }
    createGain() { return new MockNode(); }
    createBiquadFilter() { return Object.assign(new MockNode(), { type: 'lowpass', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} } }); }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    resume() {}
  };
  globalThis.window = { AudioContext: MockCtx };
  try {
    audio.unlock();
    assert.ok(audio._ctx);
    for (const name of SFX_NAMES) {
      audio.play(name);
      if (name === 'shoot') {
        for (const sub of ['arrow', 'cannon', 'frost', 'support', 'sniper']) audio.play('shoot', sub);
      }
    }
    audio.startMusic();
    audio.stopMusic();
  } finally {
    delete globalThis.window;
  }
});
