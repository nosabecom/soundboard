/* Deterministic, sample-free drum and melodic voices. Shared by playback, worker, and tests. */
(function (root) {
  'use strict';

  var drumNames = [
    'Kick', 'Snare', 'Closed hat', 'Open hat',
    'Low tom', 'Mid tom', 'High tom', 'Rimshot',
    'Clap', 'Shaker', 'Cowbell', 'Tambourine',
    'Sub bass', 'Clave', 'Laser', 'Crash'
  ];

  var drumTypes = [
    'DEEP / 808', 'CRISP / SHELL', 'TIGHT / CHOKES', 'AIR / CYMBAL',
    'LOW / MEMBRANE', 'MID / MEMBRANE', 'HIGH / MEMBRANE', 'DRY / SNAP',
    '4X / SLAP', 'GRAIN / MARACA', 'DUAL / 808', 'BRIGHT / JINGLE',
    'SUB / BOOM', 'WOOD / AFRO', 'SWEEP / ZAP', 'WASH / SHIMMER'
  ];

  var hatRatios = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];

  function random(seed) {
    return function () {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 4294967296;
    };
  }

  function voice(bank, index, sr) {
    sr = sr || 44100;
    var melodic = bank !== 'drums';
    var duration = melodic
      ? (bank === 'piano' || bank === 'electric' ? 3.2 : bank === 'pad' ? 2.8 : bank === 'bass' ? 1.65 : 1.9)
      : [0.68, 0.30, 0.115, 0.62, 0.60, 0.48, 0.38, 0.14, 0.34, 0.18, 0.38, 0.30, 1.15, 0.20, 0.45, 1.55][index];

    var length = Math.ceil(sr * duration);
    var data = new Float32Array(length);
    var rng = random(173 + index * 79 + (melodic ? bank.charCodeAt(0) * 13 : 0));
    var phase = 0;
    var phase2 = 0;
    var low = 0;
    var mid = 0;

    var freq = 440 * Math.pow(2, (24 + index - 69) / 12);
    var nyquist = sr * 0.44;

    for (var n = 0; n < length; n++) {
      var t = n / sr;
      var noise = rng() * 2 - 1;
      low += (noise - low) * 0.15;
      mid += (noise - mid) * 0.42;
      var high = noise - low;
      var band = mid - low;
      var s = 0;

      if (melodic) {
        if (bank === 'piano') {
          var stretch = 0.000045;
          for (var h = 1; h <= 8; h++) {
            var pf = freq * h * Math.sqrt(1 + stretch * h * h);
            if (pf < nyquist) {
              s += Math.sin(2 * Math.PI * pf * t) * Math.exp(-t * (1.35 + h * 1.05)) / Math.pow(h, 1.32);
            }
          }
          var board = freq * 0.5 >= 28 ? Math.sin(2 * Math.PI * freq * t * 1.0008) * Math.exp(-t * 1.9) * 0.14 : 0;
          s = (s * 0.62 + board) * Math.min(1, t / 0.003) + high * Math.exp(-t * 130) * 0.075;
        } else if (bank === 'electric') {
          var modIndex = 1.75 * Math.exp(-t * 5.2);
          var bell = freq * 7 < nyquist ? Math.sin(2 * Math.PI * freq * 7 * t) * Math.exp(-t * 22) * 0.075 : 0;
          var tine = Math.sin(2 * Math.PI * freq * t + modIndex * Math.sin(2 * Math.PI * freq * 2 * t)) * Math.exp(-t * 1.95) * 0.62;
          var chorus = Math.sin(2 * Math.PI * freq * 1.0025 * t) * Math.exp(-t * 2.5) * 0.16;
          s = tine + chorus + bell;
        } else if (bank === 'organ') {
          var rotary = 1 + 0.06 * Math.sin(2 * Math.PI * 5.8 * t);
          var bars = [
            [0.5, 0.22], [1, 0.44], [1.5, 0.14], [2, 0.24], [3, 0.14], [4, 0.09], [6, 0.05]
          ];
          for (var b = 0; b < bars.length; b++) {
            var bf = freq * bars[b][0];
            if (bf >= 24 && bf < nyquist) s += Math.sin(2 * Math.PI * bf * t) * bars[b][1];
          }
          var click = band * Math.exp(-t * 180) * 0.09;
          s = (s * rotary * Math.min(1, t / 0.012) * Math.exp(-t * 1.35) + click) * 0.78;
        } else if (bank === 'synth') {
          for (var sh = 1; sh <= 11; sh++) {
            if (freq * sh < nyquist) {
              var filt = Math.exp(-sh * t * 2.6) * (0.55 + 0.45 * Math.exp(-sh * 0.22));
              s += (
                Math.sin(2 * Math.PI * freq * sh * 0.9965 * t) * 0.34 +
                Math.sin(2 * Math.PI * freq * sh * t) * 0.42 +
                Math.sin(2 * Math.PI * freq * sh * 1.0038 * t) * 0.34
              ) * filt / Math.pow(sh, 0.92);
            }
          }
          s *= Math.min(1, t / 0.007) * Math.exp(-t * 3.1) * 0.48;
        } else if (bank === 'bass') {
          var glide = freq * (1 + 0.65 * Math.exp(-t * 58));
          phase += 2 * Math.PI * glide / sr;
          var sub = Math.sin(phase) * 0.68;
          var growl = 0;
          for (var bh = 2; bh <= 6; bh++) {
            if (freq * bh < nyquist) {
              growl += Math.sin(phase * bh) * Math.exp(-t * (2.8 + bh * 2.2)) / bh;
            }
          }
          var punch = band * Math.exp(-t * 140) * 0.12;
          s = Math.tanh((sub + growl * 0.58) * 1.45) * Math.min(1, t / 0.003) * Math.exp(-t * 2.35) * 0.85 + punch;
        } else if (bank === 'pad') {
          var swell = (1 - Math.exp(-t * 15)) * Math.exp(-t * 1.15);
          for (var ph = 1; ph <= 7; ph++) {
            if (freq * ph < nyquist) {
              var weight = ph === 1 ? 0.46 : ph === 2 ? 0.28 : 0.32 / Math.pow(ph, 1.25);
              s += (
                Math.sin(2 * Math.PI * freq * ph * 0.995 * t + ph * 0.4) * 0.36 +
                Math.sin(2 * Math.PI * freq * ph * t) * 0.42 +
                Math.sin(2 * Math.PI * freq * ph * 1.0052 * t + ph * 1.1) * 0.36
              ) * weight * Math.exp(-t * ph * 0.35);
            }
          }
          s = s * swell * 0.72;
        } else {
          /* keys: Kalimba thumb-tine + warm gourd resonance */
          var k1 = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 3.2);
          var k2 = freq * 2.96 < nyquist ? 0.28 * Math.sin(2 * Math.PI * freq * 2.96 * t) * Math.exp(-t * 11) : 0;
          var k3 = freq * 5.42 < nyquist ? 0.10 * Math.sin(2 * Math.PI * freq * 5.42 * t) * Math.exp(-t * 22) : 0;
          var thumb = band * Math.exp(-t * 160) * 0.08;
          s = (k1 + k2 + k3) * Math.min(1, t / 0.0025) * 0.74 + thumb;
        }
      } else {
        switch (index) {
          case 0: /* Kick */
            phase += 2 * Math.PI * (46 + 142 * Math.exp(-t * 36)) / sr;
            s = (Math.sin(phase) + 0.16 * Math.sin(phase * 2) * Math.exp(-t * 22)) * Math.exp(-t * 8.2) + band * Math.exp(-t * 175) * 0.26;
            break;
          case 1: /* Snare */
            phase += 2 * Math.PI * (180 + 75 * Math.exp(-t * 48)) / sr;
            phase2 += 2 * Math.PI * (328 + 50 * Math.exp(-t * 48)) / sr;
            s = (Math.sin(phase) * 0.52 + Math.sin(phase2) * 0.26) * Math.exp(-t * 24) + (high * 0.68 + band * 0.25) * Math.exp(-t * 17.5);
            break;
          case 2: /* Closed hat */
          case 3: /* Open hat */
            var metal = 0;
            for (var m = 0; m < hatRatios.length; m++) {
              metal += (Math.sin(2 * Math.PI * hatRatios[m] * 8.4 * t) > 0 ? 1 : -1) * 0.11;
            }
            var hatDecay = index === 2 ? 52 : 9.2;
            s = (high * 0.58 + metal * 0.42) * Math.exp(-t * hatDecay);
            break;
          case 4:
          case 5:
          case 6: /* Low / Mid / High toms */
            var baseTom = [96, 142, 206][index - 4];
            phase += 2 * Math.PI * (baseTom + 54 * Math.exp(-t * 30)) / sr;
            s = (Math.sin(phase) * 0.88 + 0.15 * Math.sin(phase * 1.58) * Math.exp(-t * 18)) * Math.exp(-t * 9.5) + band * Math.exp(-t * 95) * 0.15;
            break;
          case 7: /* Rimshot */
            s = (
              Math.sin(2 * Math.PI * 465 * t) * 0.45 +
              Math.sin(2 * Math.PI * 1690 * t) * 0.55 +
              Math.sin(2 * Math.PI * 2980 * t) * 0.25
            ) * Math.exp(-t * 68) + high * Math.exp(-t * 140) * 0.28;
            break;
          case 8: /* Clap */
            var env = Math.exp(-t * 17) * 0.42;
            for (var c = 0; c < 4; c++) {
              var dt = t - c * 0.011;
              if (dt >= 0) env += Math.exp(-dt * 115) * 0.62;
            }
            s = (high * 0.62 + band * 0.45) * env * 0.34;
            break;
          case 9: /* Shaker */
            s = high * Math.sin(Math.PI * Math.min(1, t / 0.022)) * Math.exp(-t * 27) * 0.92;
            break;
          case 10: /* Cowbell */
            var cb1 = Math.tanh(Math.sin(2 * Math.PI * 540 * t) * 2.2) * 0.52;
            var cb2 = Math.tanh(Math.sin(2 * Math.PI * 800 * t) * 2.2) * 0.44;
            s = (cb1 + cb2) * (0.45 * Math.exp(-t * 11) + 0.55 * Math.exp(-t * 42));
            break;
          case 11: /* Tambourine */
            var jingle = 0.28 * Math.sin(2 * Math.PI * 7120 * t) + 0.22 * Math.sin(2 * Math.PI * 9180 * t) + 0.16 * Math.sin(2 * Math.PI * 11310 * t);
            var burst = 1 + 0.5 * Math.exp(-Math.max(0, t - 0.018) * 90);
            s = (high * 0.46 + jingle) * burst * Math.exp(-t * 17) * 0.78;
            break;
          case 12: /* Sub bass */
            phase += 2 * Math.PI * (41 + 32 * Math.exp(-t * 16)) / sr;
            s = (Math.sin(phase) * 0.82 + 0.22 * Math.sin(phase * 2) * Math.exp(-t * 7)) * Math.exp(-t * 3.6);
            break;
          case 13: /* Clave / Woodblock */
            s = (Math.sin(2 * Math.PI * 2420 * t) * 0.62 + Math.sin(2 * Math.PI * 1580 * t) * 0.38) * Math.exp(-t * 44) * 0.82;
            break;
          case 14: /* Laser */
            phase += 2 * Math.PI * (135 + 1850 * Math.exp(-t * 13.5)) / sr;
            s = Math.sin(phase) * Math.exp(-t * 11.5) * 0.72;
            break;
          case 15: /* Crash */
            s = (
              high * 0.64 +
              0.16 * Math.sin(2 * Math.PI * 5240 * t) +
              0.14 * Math.sin(2 * Math.PI * 6831 * t) +
              0.11 * Math.sin(2 * Math.PI * 9139 * t)
            ) * Math.exp(-t * 3.7);
            break;
        }
      }

      var edge = Math.min(1, t / 0.0015, (duration - t) / 0.012);
      var out = Math.tanh(s * 1.12) * edge * 0.78;
      data[n] = out === 0 ? 0 : out;
    }

    return { data: data, sampleRate: sr };
  }

  function waveformBars(bank, index, count) {
    count = count || 22;
    var bars = [];
    for (var i = 0; i < count; i++) {
      var x = i / (count - 1);
      var env;
      if (bank === 'pad') {
        env = Math.sin(Math.PI * Math.pow(x, 0.68)) * 0.9;
      } else if (bank === 'organ') {
        env = (x < 0.08 ? x / 0.08 : 1 - (x - 0.08) * 0.45) * (0.78 + 0.22 * Math.sin(i * 1.4));
      } else if (bank === 'bass') {
        env = Math.exp(-x * 2.1) * (0.68 + 0.32 * Math.abs(Math.cos(i * 0.85)));
      } else if (bank === 'drums') {
        var decay = [3.2, 4.5, 9.0, 2.2, 3.4, 3.8, 4.2, 8.0, 4.0, 5.5, 4.2, 4.6, 1.8, 6.8, 3.6, 1.6][index % 16];
        env = Math.exp(-x * decay) * (0.45 + 0.55 * Math.abs(Math.sin((i + 1) * (index + 3) * 0.83)));
      } else {
        env = Math.exp(-x * 2.6) * (0.38 + 0.62 * Math.abs(Math.sin(i * (index + 3) * 0.71)));
      }
      bars.push(Math.max(2, Math.min(21, +(2 + env * 19).toFixed(1))));
    }
    return bars;
  }

  function encodeWav(channels, sr) {
    var frames = channels[0].length;
    var count = channels.length;
    var buffer = new ArrayBuffer(44 + frames * count * 2);
    var view = new DataView(buffer);
    function text(offset, value) {
      for (var i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    }
    text(0, 'RIFF');
    view.setUint32(4, buffer.byteLength - 8, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, count, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * count * 2, true);
    view.setUint16(32, count * 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, frames * count * 2, true);
    for (var n = 0; n < frames; n++) {
      for (var c = 0; c < count; c++) {
        var s = Math.max(-1, Math.min(1, channels[c][n]));
        view.setInt16(44 + (n * count + c) * 2, s < 0 ? s * 32768 : s * 32767, true);
      }
    }
    return buffer;
  }

  root.SoundboardSynth = {
    voice: voice,
    waveformBars: waveformBars,
    encodeWav: encodeWav,
    drumNames: drumNames,
    drumTypes: drumTypes,
    notes: [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72, 75, 77, 79, 82, 84]
  };
})(typeof window === 'undefined' ? globalThis : window);
