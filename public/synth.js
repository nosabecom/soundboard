/* Deterministic, sample-free drum and melodic voices. Shared by playback and tests. */
(function (root) {
  'use strict';
  var drumNames = ['Kick', 'Snare', 'Closed hat', 'Open hat', 'Low tom', 'Mid tom', 'High tom', 'Rimshot', 'Clap', 'Shaker', 'Cowbell', 'Tambourine', 'Sub bass', 'Woodblock', 'Laser', 'Crash'];
  var drumTypes = ['DEEP / 808', 'CRISP / NOISE', 'TIGHT / METAL', 'AIR / METAL', 'LOW / BODY', 'MID / BODY', 'HIGH / BODY', 'DRY / SNAP', 'HANDS / WIDE', 'GRAIN / AIR', 'METAL / TONE', 'BRIGHT / JINGLE', 'LOW / SINE', 'WOOD / KNOCK', 'SPACE / ZAP', 'WASH / NOISE'];
  function random(seed) { return function () { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }; }
  function voice(bank, index, sr) {
    sr = sr || 44100;
    var melodic = bank !== 'drums';
    var duration = melodic ? (bank === 'piano' || bank === 'electric' ? 3.2 : 1.8) : [0.65, 0.28, 0.11, 0.6, 0.6, 0.48, 0.38, 0.14, 0.32, 0.18, 0.36, 0.28, 1.1, 0.22, 0.45, 1.5][index];
    var data = new Float32Array(Math.ceil(sr * duration)), rng = random(173 + index * 79), phase = 0, low = 0;
    
    var freq = 440 * Math.pow(2, (24 + index - 69) / 12);
    for (var n = 0; n < data.length; n++) {
      var t = n / sr, noise = rng() * 2 - 1, s = 0, high = noise - low;
      low += (noise - low) * 0.16;
      if (melodic) {
        if (bank === 'piano') {
          for (var h = 1; h <= 7; h++) if (freq * h < sr * .44) s += Math.sin(2 * Math.PI * freq * h * Math.sqrt(1 + .00004 * h * h) * t) * Math.exp(-t * (1.5 + h * 1.15)) / Math.pow(h, 1.35);
          s = s * .65 + high * Math.exp(-t * 120) * .09;
        } else if (bank === 'electric') {
          s = Math.sin(2 * Math.PI * freq * t + 1.6 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 5)) * Math.exp(-t * 2.1) * .65 + Math.sin(2 * Math.PI * freq * 1.002 * t) * Math.exp(-t * 3) * .12;
        } else if (bank === 'organ') {
          s = (Math.sin(2 * Math.PI * freq * t) * .5 + (freq * 2 < sr * .44 ? Math.sin(2 * Math.PI * freq * 2 * t) * .27 : 0) + (freq * 3 < sr * .44 ? Math.sin(2 * Math.PI * freq * 3 * t) * .15 : 0) + (freq * 4 < sr * .44 ? Math.sin(2 * Math.PI * freq * 4 * t) * .08 : 0)) * Math.min(1, t / .015) * Math.exp(-t * 1.5) * .8;
        } else if (bank === 'synth') {
          for (var h = 1; h <= 10; h++) if (freq * h < sr * .44) s += (Math.sin(2 * Math.PI * freq * h * t) + .45 * Math.sin(2 * Math.PI * freq * h * 1.004 * t)) * Math.exp(-h * t * 3) / h;
          s *= Math.min(1, t / .008) * Math.exp(-t * 3.5) * .5;
        } else s = (Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 3.5) + (freq * 2 < sr * .44 ? .35 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 8) : 0) + (freq * 3 < sr * .44 ? .12 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-t * 14) : 0)) * .7;
      } else {
        switch (index) {
          case 0: phase += 2 * Math.PI * (48 + 125 * Math.exp(-t * 32)) / sr; s = Math.sin(phase) * Math.exp(-t * 9) + noise * Math.exp(-t * 160) * .25; break;
          case 1: s = high * Math.exp(-t * 19) * .75 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 24) * .6; break;
          case 2: case 3: s = (high * .6 + Math.sin(2 * Math.PI * 7400 * t) * .12) * Math.exp(-t * (index === 2 ? 55 : 10)); break;
          case 4: case 5: case 6: phase += 2 * Math.PI * ([100, 145, 210][index - 4] + 45 * Math.exp(-t * 30)) / sr; s = Math.sin(phase) * Math.exp(-t * 10) + noise * Math.exp(-t * 70) * .13; break;
          case 7: s = (Math.sin(2 * Math.PI * 820 * t) + .7 * Math.sin(2 * Math.PI * 1800 * t)) * Math.exp(-t * 65) * .5 + high * Math.exp(-t * 120) * .3; break;
          case 8: var env = Math.exp(-t * 20); for (var c = 0; c < 3; c++) if (t > c * .013) env += Math.exp(-(t - c * .013) * 100) * .7; s = high * env * .3; break;
          case 9: s = high * Math.sin(Math.PI * Math.min(1, t / .015)) * Math.exp(-t * 28); break;
          case 10: s = (.5 * Math.sin(2 * Math.PI * 540 * t) + .35 * Math.sin(2 * Math.PI * 800 * t) + .15 * Math.sin(2 * Math.PI * 1610 * t)) * Math.exp(-t * 15); break;
          case 11: s = (high * .5 + .25 * Math.sin(2 * Math.PI * 7100 * t) + .2 * Math.sin(2 * Math.PI * 9137 * t)) * Math.exp(-t * 18); break;
          case 12: phase += 2 * Math.PI * (42 + 26 * Math.exp(-t * 15)) / sr; s = Math.sin(phase) * Math.exp(-t * 4) * .85; break;
          case 13: s = (Math.sin(2 * Math.PI * 720 * t) + .3 * Math.sin(2 * Math.PI * 1120 * t)) * Math.exp(-t * 35) * .7; break;
          case 14: phase += 2 * Math.PI * (150 + 1700 * Math.exp(-t * 13)) / sr; s = Math.sin(phase) * Math.exp(-t * 12) * .7; break;
          case 15: s = (high * .7 + .18 * Math.sin(2 * Math.PI * 6331 * t) + .1 * Math.sin(2 * Math.PI * 8939 * t)) * Math.exp(-t * 4); break;
        }
      }
      var edge = Math.min(1, t / .0015, (duration - t) / .012);
      data[n] = Math.tanh(s * 1.1) * edge * .78;
    }
    return { data: data, sampleRate: sr };
  }
  function encodeWav(channels, sr) {
    var frames = channels[0].length, count = channels.length, buffer = new ArrayBuffer(44 + frames * count * 2), view = new DataView(buffer);
    function text(offset, value) { for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); }
    text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, sr, true); view.setUint32(28, sr * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * count * 2, true);
    for (var n = 0; n < frames; n++) for (var c = 0; c < count; c++) { var s = Math.max(-1, Math.min(1, channels[c][n])); view.setInt16(44 + (n * count + c) * 2, s < 0 ? s * 32768 : s * 32767, true); }
    return buffer;
  }
  root.SoundboardSynth = { voice: voice, encodeWav: encodeWav, drumNames: drumNames, drumTypes: drumTypes, notes: [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84] };
})(typeof window === 'undefined' ? globalThis : window);
