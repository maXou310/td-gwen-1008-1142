// audio-probe.mjs — import audio.js in node, verify basics, exit 0 on success.
import assert from 'node:assert/strict';
import { audio, buildMelody, SYNTH_SPECS } from '../src/audio/audio.js';

console.log('audio import OK');
console.log('synth spec table size:', Object.keys(SYNTH_SPECS).length);
const mel = buildMelody(42);
console.log('buildMelody(42) length:', mel.length, 'span(s):', mel[mel.length - 1].time);
assert.equal(Object.keys(SYNTH_SPECS).length, 13);
assert.ok(mel.length > 0 && mel[mel.length - 1].time >= 15);
assert.equal(audio._ctx, null); // no unlock in node
console.log('probe OK');
