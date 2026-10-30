/* Layout, scale/chord theory, groove presets, and share codec. Safe defaults repair invalid state. */
(function (root) {
  'use strict';

  var modes = ['drums', 'bass', 'piano', 'electric', 'organ', 'synth', 'pad', 'keys', 'earshot'];

  var names = {
    drums: 'Drum kit',
    bass: '808 & Bass',
    piano: 'Grand piano',
    electric: 'Electric piano',
    organ: 'Organ',
    synth: 'Analog synth',
    pad: 'Lush pad',
    keys: 'Kalimba',
    earshot: 'Earshot SFX'
  };

  var scales = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 3, 5, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    blues: [0, 3, 5, 6, 7, 10],
    hirajoshi: [0, 2, 3, 7, 8]
  };

  var chordModes = ['off', 'fifth', 'triad', 'seventh', 'ninth'];
  var noteLetters = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  var grooveCatalog = {
    lagos: {
      name: 'Lagos Bounce',
      bpm: 104,
      swing: 16,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0] },
        { bank: 'drums', index: 7, board: 'drums', slot: 7, steps: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0] },
        { bank: 'drums', index: 9, board: 'drums', slot: 9, steps: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1] },
        { bank: 'drums', index: 13, board: 'drums', slot: 13, steps: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
        { bank: 'bass', index: 12, board: 'bass', slot: 0, steps: [2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'bass', index: 19, board: 'bass', slot: 3, steps: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 0] },
        { bank: 'keys', index: 39, board: 'keys', slot: 6, steps: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
        { bank: 'keys', index: 43, board: 'keys', slot: 8, steps: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0] }
      ]
    },
    boombap: {
      name: '90s Boom Bap',
      bpm: 90,
      swing: 28,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0, 0, 0] },
        { bank: 'drums', index: 1, board: 'drums', slot: 1, steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1] },
        { bank: 'drums', index: 2, board: 'drums', slot: 2, steps: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] },
        { bank: 'drums', index: 3, board: 'drums', slot: 3, steps: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'bass', index: 12, board: 'bass', slot: 0, steps: [2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0] },
        { bank: 'bass', index: 15, board: 'bass', slot: 1, steps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0] },
        { bank: 'electric', index: 24, board: 'electric', slot: 0, chord: 'seventh', scale: 'dorian', root: 0, steps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'electric', index: 29, board: 'electric', slot: 3, chord: 'seventh', scale: 'dorian', root: 0, steps: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] }
      ]
    },
    garage: {
      name: 'UK 2-Step',
      bpm: 132,
      swing: 22,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0] },
        { bank: 'drums', index: 1, board: 'drums', slot: 1, steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0] },
        { bank: 'drums', index: 7, board: 'drums', slot: 7, steps: [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1] },
        { bank: 'drums', index: 2, board: 'drums', slot: 2, steps: [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0] },
        { bank: 'drums', index: 3, board: 'drums', slot: 3, steps: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0] },
        { bank: 'bass', index: 12, board: 'bass', slot: 0, steps: [2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0] },
        { bank: 'organ', index: 27, board: 'organ', slot: 2, chord: 'triad', scale: 'minor', root: 0, steps: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0] }
      ]
    },
    lofi: {
      name: 'Midnight Lo-Fi',
      bpm: 78,
      swing: 32,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'drums', index: 7, board: 'drums', slot: 7, steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0] },
        { bank: 'drums', index: 9, board: 'drums', slot: 9, steps: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0] },
        { bank: 'earshot', index: 5, board: 'earshot', slot: 5, gain: 0.45, steps: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0] },
        { bank: 'electric', index: 24, board: 'electric', slot: 0, chord: 'ninth', scale: 'dorian', root: 0, steps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'electric', index: 20, board: 'electric', slot: 4, chord: 'seventh', scale: 'minor', root: 0, steps: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0] }
      ]
    },
    trap: {
      name: '808 Studio',
      bpm: 138,
      swing: 0,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0] },
        { bank: 'drums', index: 8, board: 'drums', slot: 8, steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0] },
        { bank: 'drums', index: 2, board: 'drums', slot: 2, steps: [1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 2, 2] },
        { bank: 'drums', index: 3, board: 'drums', slot: 3, steps: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
        { bank: 'bass', index: 12, board: 'bass', slot: 0, steps: [2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0] },
        { bank: 'keys', index: 36, board: 'keys', slot: 5, steps: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] }
      ]
    },
    electro: {
      name: 'Neon Drive',
      bpm: 118,
      swing: 6,
      tracks: [
        { bank: 'drums', index: 0, board: 'drums', slot: 0, steps: [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0] },
        { bank: 'drums', index: 1, board: 'drums', slot: 1, steps: [0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0] },
        { bank: 'drums', index: 8, board: 'drums', slot: 8, steps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
        { bank: 'drums', index: 2, board: 'drums', slot: 2, steps: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0] },
        { bank: 'synth', index: 12, board: 'synth', slot: 0, steps: [2, 0, 1, 0, 0, 1, 0, 1, 2, 0, 1, 0, 0, 0, 0, 0] },
        { bank: 'synth', index: 15, board: 'synth', slot: 3, steps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 1, 1] },
        { bank: 'pad', index: 24, board: 'pad', slot: 0, chord: 'seventh', scale: 'minor', root: 0, steps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
      ]
    }
  };

  function hasOwn(obj, key) {
    return Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function melodic(mode) {
    return mode !== 'drums' && mode !== 'earshot';
  }

  function noteName(index) {
    var midi = 24 + index;
    return noteLetters[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  function settings(mode) {
    if (mode === 'bass') return { root: 0, octave: 2, scale: 'pentatonic', chord: 'off' };
    if (mode === 'pad') return { root: 0, octave: 3, scale: 'dorian', chord: 'seventh' };
    if (mode === 'keys') return { root: 0, octave: 3, scale: 'pentatonic', chord: 'off' };
    return { root: 0, octave: 3, scale: 'chromatic', chord: 'off' };
  }

  function clampIndex(idx) {
    while (idx >= 96) idx -= 12;
    while (idx < 0) idx += 12;
    return idx;
  }

  function chordIntervals(index, config) {
    var chord = config && hasOwn( { off: 1, fifth: 1, triad: 1, seventh: 1, ninth: 1 }, config.chord) ? config.chord : 'off';
    if (chord === 'off') return [0];
    if (chord === 'fifth') return [0, 7];

    var midi = 24 + index;
    var root = config && typeof config.root === 'number' ? config.root : 0;
    var scaleKey = config && hasOwn(scales, config.scale) ? config.scale : 'chromatic';
    var scale = scales[scaleKey];
    var rel = (((midi - root) % 12) + 12) % 12;
    var deg = scale.indexOf(rel);

    var third, fifth, seventh, ninth;
    if (scale.length === 7 && deg >= 0) {
      function stepOffset(steps) {
        return Math.floor((deg + steps) / 7) * 12 + scale[(deg + steps) % 7] - rel;
      }
      third = stepOffset(2);
      fifth = stepOffset(4);
      seventh = stepOffset(6);
      ninth = stepOffset(8);
    } else {
      var hasMinor3 = scale.indexOf((rel + 3) % 12) >= 0 && scale.indexOf((rel + 4) % 12) < 0;
      var isMinorScale = scaleKey === 'minor' || scaleKey === 'pentatonic' || scaleKey === 'blues' || scaleKey === 'hirajoshi' || hasMinor3;
      third = isMinorScale ? 3 : 4;
      fifth = 7;
      seventh = isMinorScale ? 10 : 11;
      ninth = 14;
    }

    if (chord === 'triad') return [0, third, fifth];
    if (chord === 'seventh') return [0, third, fifth, seventh];
    return [0, third, seventh, ninth];
  }

  function chordNotes(index, config) {
    var intervals = chordIntervals(index, config);
    var out = [];
    for (var i = 0; i < intervals.length; i++) {
      var target = clampIndex(index + intervals[i]);
      if (out.indexOf(target) < 0) out.push(target);
    }
    return out;
  }

  function chordLabel(index, config) {
    var intervals = chordIntervals(index, config);
    if (intervals.length <= 1) return noteName(index);
    var midi = 24 + index;
    var letter = noteLetters[((midi % 12) + 12) % 12];
    if (config && config.chord === 'fifth') return letter + '5';
    var third = intervals[1];
    var fifth = config && config.chord === 'ninth' ? 7 : intervals[2];
    var seventh = config && config.chord === 'ninth' ? intervals[2] : intervals[3];
    var quality = third === 3 ? (fifth === 6 ? 'dim' : 'm') : (fifth === 8 ? 'aug' : '');
    if (config && config.chord === 'triad') return letter + quality;
    if (config && config.chord === 'seventh') {
      if (third === 3 && fifth === 6 && seventh === 10) return letter + 'm7♭5';
      if (third === 4 && seventh === 11) return letter + 'maj7';
      if (third === 3 && seventh === 11) return letter + 'm(maj7)';
      return letter + quality + '7';
    }
    if (third === 4 && seventh === 11) return letter + 'maj9';
    return letter + quality + '9';
  }

  function defaultPad(mode, index, config) {
    if (!melodic(mode)) return { bank: mode, index: index % 16 };
    config = config || settings(mode);
    var scale = hasOwn(scales, config.scale) ? scales[config.scale] : scales.chromatic;
    var midi = (config.octave + 1) * 12 + config.root + Math.floor(index / scale.length) * 12 + scale[index % scale.length];
    while (midi > 119) midi -= 12;
    while (midi < 24) midi += 12;
    return { bank: mode, index: midi - 24 };
  }

  function number(value, min, max, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  }

  function normalizePad(pad, mode, index, modeSettings) {
    if (pad && typeof pad === 'object' && modes.indexOf(pad.bank) >= 0 && Number.isInteger(pad.index) && pad.index >= 0 && pad.index < (melodic(pad.bank) ? 96 : 16)) {
      var clean = { bank: pad.bank, index: pad.index };
      var tune = Math.round(number(pad.tune, -12, 12, 0));
      var gain = +number(pad.gain, 0.2, 1.25, 1).toFixed(2);
      if (tune !== 0) clean.tune = tune;
      if (gain !== 1) clean.gain = gain;
      return clean;
    }
    return defaultPad(mode, index, modeSettings);
  }

  function cloneGrooveTracks(key) {
    var preset = hasOwn(grooveCatalog, key) ? grooveCatalog[key] : grooveCatalog.lagos;
    return preset.tracks.map(function (t) {
      var track = {
        bank: t.bank,
        index: t.index,
        board: t.board || t.bank,
        slot: typeof t.slot === 'number' ? t.slot : 0,
        steps: t.steps.slice(0, 16)
      };
      if (t.tune) track.tune = t.tune;
      if (t.gain && t.gain !== 1) track.gain = t.gain;
      if (t.chord && t.chord !== 'off') track.chord = t.chord;
      if (t.scale) track.scale = t.scale;
      if (typeof t.root === 'number') track.root = t.root;
      return track;
    });
  }

  function normalizeTracks(rawTracks, fallbackGroove) {
    if (!Array.isArray(rawTracks)) return cloneGrooveTracks(fallbackGroove);
    var cleaned = [];
    for (var i = 0; i < rawTracks.length && cleaned.length < 24; i++) {
      var t = rawTracks[i];
      if (!t || typeof t !== 'object') continue;
      if (modes.indexOf(t.bank) < 0) continue;
      var maxIdx = melodic(t.bank) ? 96 : 16;
      if (!Number.isInteger(t.index) || t.index < 0 || t.index >= maxIdx) continue;
      if (!Array.isArray(t.steps)) continue;
      var steps = Array.from({ length: 16 }, function (_, s) {
        var v = t.steps[s];
        return v === 1 || v === 2 ? v : 0;
      });
      if (!steps.some(Boolean)) continue;
      var entry = {
        bank: t.bank,
        index: t.index,
        board: modes.indexOf(t.board) >= 0 ? t.board : t.bank,
        slot: Number.isInteger(t.slot) && t.slot >= 0 && t.slot < 64 ? t.slot : 0,
        steps: steps
      };
      var tune = Math.round(number(t.tune, -12, 12, 0));
      var gain = +number(t.gain, 0.2, 1.25, 1).toFixed(2);
      if (tune !== 0) entry.tune = tune;
      if (gain !== 1) entry.gain = gain;
      if (chordModes.indexOf(t.chord) > 0) entry.chord = t.chord;
      if (hasOwn(scales, t.scale)) entry.scale = t.scale;
      if (Number.isInteger(t.root) && t.root >= 0 && t.root <= 11) entry.root = t.root;
      cleaned.push(entry);
    }
    return cleaned;
  }

  function normalize(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var groove = hasOwn(grooveCatalog, raw.groove) || raw.groove === 'custom' ? raw.groove : 'lagos';
    var defaultGroove = hasOwn(grooveCatalog, groove) ? grooveCatalog[groove] : grooveCatalog.lagos;

    var result = {
      version: 3,
      mode: modes.indexOf(raw.mode) >= 0 ? raw.mode : 'drums',
      size: [2, 3, 4, 6, 8].indexOf(raw.size) >= 0 ? raw.size : 4,
      volume: +number(raw.volume, 0, 1, 0.75).toFixed(3),
      pitch: Math.round(number(raw.pitch, -12, 12, 0)),
      room: +number(raw.room, 0, 0.7, 0.15).toFixed(3),
      filter: Math.round(number(raw.filter, -100, 100, 0)),
      delay: +number(raw.delay, 0, 0.65, 0).toFixed(3),
      bpm: Math.round(number(raw.bpm, 60, 180, defaultGroove.bpm)),
      swing: Math.round(number(raw.swing, 0, 60, defaultGroove.swing)),
      quantize: Boolean(raw.quantize),
      metronome: Boolean(raw.metronome),
      groove: groove,
      tracks: normalizeTracks(raw.tracks, groove === 'custom' ? 'lagos' : groove),
      boards: {},
      settings: {}
    };

    modes.forEach(function (mode) {
      var config = raw.settings && hasOwn(raw.settings, mode) && raw.settings[mode] || {};
      var preset = settings(mode);
      result.settings[mode] = {
        root: Math.round(number(config.root, 0, 11, preset.root)),
        octave: Math.round(number(config.octave, 1, 5, preset.octave)),
        scale: hasOwn(scales, config.scale) ? config.scale : preset.scale,
        chord: chordModes.indexOf(config.chord) >= 0 ? config.chord : preset.chord
      };
      var pads = raw.boards && hasOwn(raw.boards, mode) ? raw.boards[mode] : null;
      result.boards[mode] = Array.from({ length: 64 }, function (_, i) {
        var pad = Array.isArray(pads) ? pads[i] : null;
        return normalizePad(pad, mode, i, result.settings[mode]);
      });
    });

    return result;
  }

  function toBase64Url(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(token) {
    var padded = token.replace(/-/g, '+').replace(/_/g, '/');
    while (padded.length % 4) padded += '=';
    var bin = atob(padded);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function encodeShare(state) {
    var s = normalize(state);
    var customPads = {};
    var limit = s.size * s.size;
    var currentBoard = s.boards[s.mode];
    var cfg = s.settings[s.mode];
    for (var i = 0; i < limit; i++) {
      var p = currentBoard[i];
      var def = defaultPad(s.mode, i, cfg);
      if (p.bank !== def.bank || p.index !== def.index || p.tune || p.gain) {
        customPads[i] = [p.bank, p.index, p.tune || 0, p.gain || 1];
      }
    }
    var payload = {
      m: s.mode,
      z: s.size,
      v: s.volume,
      p: s.pitch,
      r: s.room,
      f: s.filter,
      d: s.delay,
      b: s.bpm,
      w: s.swing,
      g: s.groove,
      c: [cfg.root, cfg.octave, cfg.scale, cfg.chord],
      k: Object.keys(customPads).length ? customPads : undefined,
      t: s.tracks.map(function (t) {
        return [t.bank, t.index, t.steps.join(''), t.board, t.slot, t.tune || 0, t.gain || 1, t.chord || 'off', t.scale || '', typeof t.root === 'number' ? t.root : -1];
      })
    };
    return 's=' + toBase64Url(JSON.stringify(payload));
  }

  function decodeShare(hash, baseState) {
    if (typeof hash !== 'string') return null;
    var clean = hash.replace(/^#/, '');
    if (clean.indexOf('s=') !== 0 || clean.length > 8192) return null;
    try {
      var raw = JSON.parse(fromBase64Url(clean.slice(2)));
      if (!raw || typeof raw !== 'object') return null;
      var next = normalize(baseState);
      var mode = modes.indexOf(raw.m) >= 0 ? raw.m : next.mode;
      next.mode = mode;
      if ([2, 3, 4, 6, 8].indexOf(raw.z) >= 0) next.size = raw.z;
      next.volume = number(raw.v, 0, 1, next.volume);
      next.pitch = number(raw.p, -12, 12, next.pitch);
      next.room = number(raw.r, 0, 0.7, next.room);
      next.filter = number(raw.f, -100, 100, next.filter);
      next.delay = number(raw.d, 0, 0.65, next.delay);
      next.bpm = number(raw.b, 60, 180, next.bpm);
      next.swing = number(raw.w, 0, 60, next.swing);
      if (hasOwn(grooveCatalog, raw.g) || raw.g === 'custom') next.groove = raw.g;
      if (Array.isArray(raw.c)) {
        next.settings[mode] = {
          root: Math.round(number(raw.c[0], 0, 11, 0)),
          octave: Math.round(number(raw.c[1], 1, 5, 3)),
          scale: hasOwn(scales, raw.c[2]) ? raw.c[2] : settings(mode).scale,
          chord: chordModes.indexOf(raw.c[3]) >= 0 ? raw.c[3] : settings(mode).chord
        };
        next.boards[mode] = Array.from({ length: 64 }, function (_, i) {
          return defaultPad(mode, i, next.settings[mode]);
        });
      }
      if (raw.k && typeof raw.k === 'object') {
        Object.keys(raw.k).forEach(function (slotKey) {
          var idx = Number(slotKey);
          var entry = raw.k[slotKey];
          if (Number.isInteger(idx) && idx >= 0 && idx < 64 && Array.isArray(entry)) {
            next.boards[mode][idx] = normalizePad({
              bank: entry[0],
              index: entry[1],
              tune: entry[2],
              gain: entry[3]
            }, mode, idx, next.settings[mode]);
          }
        });
      }
      if (Array.isArray(raw.t)) {
        next.tracks = raw.t.slice(0, 24).map(function (arr) {
          if (!Array.isArray(arr) || typeof arr[2] !== 'string') return null;
          return {
            bank: arr[0],
            index: arr[1],
            steps: arr[2].split('').slice(0, 16).map(Number),
            board: arr[3],
            slot: arr[4],
            tune: arr[5],
            gain: arr[6],
            chord: arr[7],
            scale: arr[8] || undefined,
            root: typeof arr[9] === 'number' && arr[9] >= 0 ? arr[9] : undefined
          };
        }).filter(Boolean);
      }
      return normalize(next);
    } catch (_) {
      return null;
    }
  }

  root.SoundboardLayout = {
    modes: modes,
    names: names,
    scales: scales,
    chordModes: chordModes,
    grooves: grooveCatalog,
    cloneGrooveTracks: cloneGrooveTracks,
    melodic: melodic,
    noteName: noteName,
    chordNotes: chordNotes,
    chordLabel: chordLabel,
    defaultPad: defaultPad,
    normalize: normalize,
    encodeShare: encodeShare,
    decodeShare: decodeShare
  };
})(typeof window === 'undefined' ? globalThis : window);
