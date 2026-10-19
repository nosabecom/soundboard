/* Layout model. Invalid or stale saved values are replaced with safe defaults. */
(function (root) {
  'use strict';
  var modes = ['drums', 'piano', 'electric', 'organ', 'synth', 'keys', 'earshot'];
  var names = { drums: 'Drum kit', piano: 'Grand piano', electric: 'Electric piano', organ: 'Organ', synth: 'Analog synth', keys: 'Kalimba', earshot: 'Earshot SFX' };
  var scales = { chromatic: [0,1,2,3,4,5,6,7,8,9,10,11], major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10], pentatonic: [0,3,5,7,10] };
  function melodic(mode) { return mode !== 'drums' && mode !== 'earshot'; }
  function noteName(index) { var midi = 24 + index; return ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][midi % 12] + (Math.floor(midi / 12) - 1); }
  function settings(mode) { return { root: 0, octave: 3, scale: mode === 'keys' ? 'pentatonic' : 'chromatic' }; }
  function defaultPad(mode, index, config) {
    if (!melodic(mode)) return { bank: mode, index: index % 16 };
    config = config || settings(mode);
    var scale = scales[config.scale], midi = (config.octave + 1) * 12 + config.root + Math.floor(index / scale.length) * 12 + scale[index % scale.length];
    while (midi > 119) midi -= 12;
    return { bank: mode, index: midi - 24 };
  }
  function number(value, min, max, fallback) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback; }
  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var result = { version: 2, mode: modes.indexOf(raw.mode) >= 0 ? raw.mode : 'drums', size: [2,3,4,6,8].indexOf(raw.size) >= 0 ? raw.size : 4, volume: number(raw.volume,0,1,.75), pitch: Math.round(number(raw.pitch,-12,12,0)), room: number(raw.room,0,.7,.15), boards: {}, settings: {} };
    modes.forEach(function (mode) {
      var config = raw.settings && raw.settings[mode] || {}, preset = settings(mode);
      result.settings[mode] = { root: Math.round(number(config.root,0,11,0)), octave: Math.round(number(config.octave,2,4,3)), scale: Object.prototype.hasOwnProperty.call(scales, config.scale) ? config.scale : preset.scale };
      var pads = raw.boards && raw.boards[mode];
      result.boards[mode] = Array.from({length:64}, function (_, i) {
        var pad = Array.isArray(pads) ? pads[i] : null;
        if (pad && modes.indexOf(pad.bank) >= 0 && Number.isInteger(pad.index) && pad.index >= 0 && pad.index < (melodic(pad.bank) ? 96 : 16)) return { bank: pad.bank, index: pad.index };
        return defaultPad(mode, i, result.settings[mode]);
      });
    });
    return result;
  }
  root.SoundboardLayout = { modes: modes, names: names, scales: scales, melodic: melodic, noteName: noteName, defaultPad: defaultPad, normalize: normalize };
})(typeof window === 'undefined' ? globalThis : window);
