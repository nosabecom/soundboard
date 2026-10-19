import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/layout.js');
const layout = globalThis.SoundboardLayout;
test('every grid size has enough valid pads across all seven instruments', () => {
  const state = layout.normalize();
  assert.equal(layout.modes.length, 7);
  for (const mode of layout.modes) {
    assert.equal(state.boards[mode].length, 64);
    for (const size of [2,3,4,6,8]) {
      const pads = state.boards[mode].slice(0, size * size);
      assert.equal(pads.length, size * size);
      assert.ok(pads.every(p => p.bank === mode && p.index >= 0 && p.index < (layout.melodic(mode) ? 96 : 16)));
    }
  }
});
test('mixed pad mappings survive serialization without leaking across modes', () => {
  const state = layout.normalize();
  state.boards.drums[0] = {bank:'piano',index:24};
  state.boards.drums[1] = {bank:'earshot',index:5};
  state.boards.piano[63] = {bank:'organ',index:42};
  state.mode='piano'; state.size=8;
  assert.deepEqual(layout.normalize(JSON.parse(JSON.stringify(state))), state);
  assert.equal(state.boards.electric[0].bank, 'electric');
});
test('invalid persisted data is repaired, including malformed mappings and settings', () => {
  const state=layout.normalize({mode:'bogus',size:99,volume:-1,pitch:NaN,room:7,boards:{drums:[{bank:'x',index:9},{bank:'drums',index:999}]},settings:{piano:{scale:'__proto__',octave:50,root:-12}}});
  assert.equal(state.mode,'drums'); assert.equal(state.size,4); assert.equal(state.volume,.75); assert.equal(state.room,.15);
  assert.deepEqual(state.boards.drums[0],{bank:'drums',index:0});
  assert.deepEqual(state.boards.drums[1],{bank:'drums',index:1});
  assert.equal(state.settings.piano.scale,'chromatic');
});
test('scale, octave, and root remap pitched notes within playable MIDI bounds', () => {
  assert.equal(layout.noteName(layout.defaultPad('piano',0,{root:0,octave:3,scale:'chromatic'}).index),'C3');
  assert.equal(layout.noteName(layout.defaultPad('piano',1,{root:2,octave:4,scale:'major'}).index),'E4');
  for (const scale of Object.keys(layout.scales)) for (let index=0;index<64;index++) {
    const pad=layout.defaultPad('piano',index,{root:11,octave:4,scale});
    assert.ok(pad.index>=0 && pad.index<96);
  }
});
