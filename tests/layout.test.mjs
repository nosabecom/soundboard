import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/layout.js');
const layout = globalThis.SoundboardLayout;

test('every grid size has enough valid pads across all nine instruments', () => {
  const state = layout.normalize();
  assert.equal(layout.modes.length, 9);
  for (const mode of layout.modes) {
    assert.equal(state.boards[mode].length, 64);
    for (const size of [2, 3, 4, 6, 8]) {
      const pads = state.boards[mode].slice(0, size * size);
      assert.equal(pads.length, size * size);
      assert.ok(pads.every(p => p.bank === mode && p.index >= 0 && p.index < (layout.melodic(mode) ? 96 : 16)));
    }
  }
});

test('mixed pad mappings and per-pad trim survive serialization without leaking across modes', () => {
  const state = layout.normalize();
  state.boards.drums[0] = { bank: 'piano', index: 24, tune: -3, gain: 0.85 };
  state.boards.drums[1] = { bank: 'earshot', index: 5 };
  state.boards.piano[63] = { bank: 'organ', index: 42, tune: 7 };
  state.mode = 'piano';
  state.size = 8;
  assert.deepEqual(layout.normalize(JSON.parse(JSON.stringify(state))), state);
  assert.equal(state.boards.electric[0].bank, 'electric');
});

test('invalid persisted data is repaired, including malformed mappings, tracks, and prototype keys', () => {
  const state = layout.normalize({
    mode: 'bogus',
    size: 99,
    volume: -1,
    pitch: NaN,
    room: 7,
    filter: 999,
    delay: -5,
    bpm: 999,
    swing: -20,
    groove: '__proto__',
    tracks: [{ bank: '__proto__', index: 0, steps: [1] }, { bank: 'drums', index: 0, steps: Array(16).fill(0) }],
    boards: { drums: [{ bank: 'x', index: 9 }, { bank: 'drums', index: 999 }] },
    settings: { piano: { scale: '__proto__', octave: 50, root: -12, chord: 'constructor' } }
  });
  assert.equal(state.mode, 'drums');
  assert.equal(state.size, 4);
  assert.equal(state.volume, 0.75);
  assert.equal(state.room, 0.15);
  assert.equal(state.filter, 0);
  assert.equal(state.delay, 0);
  assert.equal(state.bpm, 104);
  assert.equal(state.groove, 'lagos');
  assert.deepEqual(state.boards.drums[0], { bank: 'drums', index: 0 });
  assert.deepEqual(state.boards.drums[1], { bank: 'drums', index: 1 });
  assert.equal(state.settings.piano.scale, 'chromatic');
  assert.equal(state.settings.piano.octave, 3);
  assert.equal(state.settings.piano.chord, 'off');
  assert.equal(state.tracks.length, 0);
});

test('scale, octave, root, and diatonic chord engine produce bounded playable notes and labels', () => {
  assert.equal(layout.noteName(layout.defaultPad('piano', 0, { root: 0, octave: 3, scale: 'chromatic' }).index), 'C3');
  assert.equal(layout.noteName(layout.defaultPad('piano', 1, { root: 2, octave: 4, scale: 'major' }).index), 'E4');

  // Diatonic 7th chords in C Major: C -> Cmaj7, D -> Dm7, B -> Bm7♭5
  assert.equal(layout.chordLabel(24, { root: 0, scale: 'major', chord: 'seventh' }), 'Cmaj7');
  assert.equal(layout.chordLabel(26, { root: 0, scale: 'major', chord: 'seventh' }), 'Dm7');
  assert.equal(layout.chordLabel(35, { root: 0, scale: 'major', chord: 'seventh' }), 'Bm7♭5');
  assert.deepEqual(layout.chordNotes(24, { root: 0, scale: 'dorian', chord: 'seventh' }), [24, 27, 31, 34]);

  for (const scale of Object.keys(layout.scales)) {
    for (const chord of layout.chordModes) {
      for (let index = 0; index < 64; index++) {
        const pad = layout.defaultPad('piano', index, { root: 11, octave: 5, scale });
        assert.ok(pad.index >= 0 && pad.index < 96);
        const notes = layout.chordNotes(pad.index, { root: 11, scale, chord });
        assert.ok(notes.length >= 1 && notes.every(n => n >= 0 && n < 96));
      }
    }
  }
});

test('all curated groove presets normalize cleanly with 16-step patterns', () => {
  for (const [key, preset] of Object.entries(layout.grooves)) {
    assert.ok(preset.bpm >= 60 && preset.bpm <= 180, key);
    const cloned = layout.cloneGrooveTracks(key);
    assert.ok(cloned.length >= 4, key);
    for (const trk of cloned) {
      assert.equal(trk.steps.length, 16);
      assert.ok(trk.steps.some(v => v === 1 || v === 2));
    }
  }
});

test('share codec round-trips custom pads, FX, chord settings, and custom sequencer patterns', () => {
  const original = layout.normalize();
  original.mode = 'electric';
  original.size = 4;
  original.bpm = 96;
  original.swing = 24;
  original.filter = -35;
  original.delay = 0.28;
  original.settings.electric = { root: 3, octave: 3, scale: 'dorian', chord: 'ninth' };
  original.boards.electric = Array.from({ length: 64 }, (_, i) => layout.defaultPad('electric', i, original.settings.electric));
  original.boards.electric[2] = { bank: 'drums', index: 8, tune: -2, gain: 0.9 };
  original.groove = 'custom';
  original.tracks = [
    { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0] }
  ];

  const encoded = layout.encodeShare(original);
  assert.ok(encoded.startsWith('s='));
  const decoded = layout.decodeShare('#' + encoded);
  assert.equal(decoded.mode, 'electric');
  assert.equal(decoded.bpm, 96);
  assert.equal(decoded.filter, -35);
  assert.equal(decoded.delay, 0.28);
  assert.deepEqual(decoded.settings.electric, { root: 3, octave: 3, scale: 'dorian', chord: 'ninth' });
  assert.deepEqual(decoded.boards.electric[2], { bank: 'drums', index: 8, tune: -2, gain: 0.9 });
  assert.equal(decoded.tracks.length, 1);
  assert.deepEqual(decoded.tracks[0].steps, [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0]);
  assert.equal(layout.decodeShare('#s=corrupted!!!'), null);
});
