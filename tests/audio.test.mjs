import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../public/synth.js');
const synth = globalThis.SoundboardSynth;

test('all synthesized voices produce finite, audible, bounded audio with soft edges', () => {
  const banks = ['drums', 'bass', 'piano', 'electric', 'organ', 'synth', 'pad', 'keys'];
  for (const bank of banks) {
    for (let i = 0; i < 16; i++) {
      const { data, sampleRate } = synth.voice(bank, i);
      assert.equal(sampleRate, 44100);
      assert.ok(data.length > 4000, `${bank} ${i} length ${data.length}`);
      assert.ok(data.every(Number.isFinite));
      const peak = data.reduce((a, x) => Math.max(a, Math.abs(x)), 0);
      assert.ok(peak > 0.05 && peak < 1, `${bank} ${i} peak ${peak}`);
      assert.ok(data[0] === 0);
      assert.ok(Math.abs(data.at(-1)) < 0.002);
    }
  }
});

test('high-register melodic notes remain alias-safe and bounded across all melodic banks', () => {
  for (const bank of ['bass', 'piano', 'electric', 'organ', 'synth', 'pad', 'keys']) {
    for (const idx of [48, 72, 95]) {
      const { data } = synth.voice(bank, idx);
      assert.ok(data.every(Number.isFinite));
      const peak = data.reduce((a, x) => Math.max(a, Math.abs(x)), 0);
      assert.ok(peak > 0.05 && peak < 1, `${bank} high note ${idx} peak ${peak}`);
    }
  }
});

test('synthesis is deterministic and all drum voices differ', () => {
  const fingerprints = new Set();
  for (let i = 0; i < 16; i++) {
    const a = synth.voice('drums', i).data;
    assert.deepEqual(a, synth.voice('drums', i).data);
    fingerprints.add(a.slice(100, 110).join(','));
  }
  assert.equal(fingerprints.size, 16);
});

test('waveformBars generates bounded bar heights for every bank', () => {
  for (const bank of ['drums', 'bass', 'piano', 'pad', 'earshot']) {
    const bars = synth.waveformBars(bank, 3, 22);
    assert.equal(bars.length, 22);
    assert.ok(bars.every(h => Number.isFinite(h) && h >= 2 && h <= 21));
  }
});

test('WAV export encodes stereo interleaving and clamps extreme sample values', () => {
  const buffer = synth.encodeWav([new Float32Array([0, 1, -2]), new Float32Array([0.5, -1, 2])], 44100);
  const view = new DataView(buffer);
  assert.equal(Buffer.from(buffer).toString('ascii', 0, 4), 'RIFF');
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 12);
  assert.equal(view.getInt16(46, true), 16383);
  assert.equal(view.getInt16(52, true), -32768);
  assert.equal(view.getInt16(54, true), 32767);
});

test('all Earshot pads have valid PCM assets and matching provenance', () => {
  const provenance = JSON.parse(fs.readFileSync('public/audio/provenance.json'));
  assert.equal(provenance.sounds.length, 16);
  for (const sound of provenance.sounds) {
    const wav = fs.readFileSync('public/audio/' + sound.file);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt16LE(20), 1);
    assert.equal(wav.readUInt32LE(24), 48000);
    assert.ok(sound.duration > 0.01 && sound.duration < 20);
  }
});
