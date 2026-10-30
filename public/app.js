(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var synth = window.SoundboardSynth;
  var model = window.SoundboardLayout;
  var audioSession = window.SoundboardAudioSession.create(navigator, document);

  var stored;
  try { stored = JSON.parse(localStorage.getItem('nosa-soundboard-v2') || '{}'); } catch (_) {}
  var state = model.normalize(stored);

  if (location.hash && location.hash.indexOf('#s=') === 0) {
    var shared = model.decodeShare(location.hash, state);
    if (shared) state = shared;
  }

  var context = null, liveChain = null, impulse = null, analyser = null;
  var buffers = {}, sources = new Set(), activeOpenHats = [], loadPromise = null, audioStarting = null;

  var keys = Array.from(new Set('1234qwerasdfzxcv567890tyuiopghjklbnm-=[];,.'.split('')));
  var colors = {
    drums: '#f0a668',
    bass: '#e8c15a',
    piano: '#9ab9f0',
    electric: '#c4a6ec',
    organ: '#7fd1c8',
    synth: '#f08b78',
    pad: '#7dc3e8',
    keys: '#bed48b',
    earshot: '#df9ec0'
  };
  var effects = [
    'Deep impact', 'Glass ping', 'Fast whoosh', 'Sub drop',
    'Bubble pop', 'Soft click', 'Glitch', 'Shimmer',
    'Space zip', 'Low knock', 'Riser', 'Swipe',
    'Kalimba', 'Key thock', 'Logo sting', 'Air fall'
  ];
  var effectTypes = [
    'CINEMATIC / HIT', 'CRYSTAL / BELL', 'AIR / SWEEP', '808 / DROP',
    'FLUID / POP', 'FOLEY / CLICK', 'DIGITAL / STUTTER', 'AMBIENT / HALO',
    'RETRO / ZIP', 'WOOD / THUMP', 'TENSION / UP', 'CLOTH / SWIPE',
    'TINE / PLUCK', 'MECH / KEY', 'SPARK / ID', 'DOWN / WASH'
  ];
  var grooveOrder = ['lagos', 'boombap', 'garage', 'lofi', 'trap', 'electro'];

  var selectedSlot = 0;
  var rollSubdiv = 0;
  var shiftHeld = false;
  var activePointers = new Map();
  var activeKeys = new Map();

  var take = [], recording = false, overdubbing = false, currentLayer = 0;
  var recordStart = 0, takeLength = 0, recordFrame = null;
  var looping = false, loopTimer = null, nextLoop = 0, currentLoopOrigin = 0;
  var seqPlaying = false, seqTimer = null, seqStep = 0, nextStepBase = 0, displayedStep = -1;
  var tapTimes = [];

  var visualTimers = new Set(), hitTimers = {}, hitLedTimer = null;
  var exporting = false, editing = false, editorIndex = null, focusBeforeEditor = null;
  var scopeMode = 'wave', scopeRaf = null, silentFrames = 0;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function save() {
    try {
      localStorage.setItem('nosa-soundboard-v2', JSON.stringify(state));
    } catch (_) {
      notify('Device storage is full. Changes will last for this session.');
    }
  }

  var voiceWorker = null, warmed = {}, pendingVoices = new Set();
  try {
    voiceWorker = new Worker('./voice-worker.js?v=9');
    voiceWorker.onmessage = function (event) {
      var voice = event.data;
      var key = voice.bank + ':' + voice.index;
      pendingVoices.delete(key);
      warmed[key] = voice;
      if (context) bufferFor(voice.bank, voice.index);
    };
    voiceWorker.onerror = function () {
      voiceWorker.terminate();
      voiceWorker = null;
      pendingVoices.clear();
    };
  } catch (_) {}

  function queueWarm(bank, index) {
    if (!voiceWorker || bank === 'earshot') return;
    var key = bank + ':' + index;
    if (warmed[key] || (buffers[bank] && buffers[bank][index]) || pendingVoices.has(key)) return;
    pendingVoices.add(key);
    voiceWorker.postMessage({ bank: bank, index: index });
  }

  function warmBoard() {
    if (!voiceWorker) return;
    var cfg = state.settings[state.mode];
    state.boards[state.mode].slice(0, state.size * state.size).forEach(function (pad) {
      if (model.melodic(pad.bank) && pad.bank === state.mode && cfg.chord !== 'off') {
        model.chordNotes(pad.index, cfg).forEach(function (idx) { queueWarm(pad.bank, idx); });
      } else {
        queueWarm(pad.bank, pad.index);
      }
    });
    state.tracks.forEach(function (t) {
      if (model.melodic(t.bank) && t.chord && t.chord !== 'off') {
        model.chordNotes(t.index, { root: t.root || 0, scale: t.scale || 'dorian', chord: t.chord }).forEach(function (idx) {
          queueWarm(t.bank, idx);
        });
      } else {
        queueWarm(t.bank, t.index);
      }
    });
  }

  var noticeTimer;
  function notify(message) {
    $('notice').textContent = message;
    clearTimeout(noticeTimer);
    if (message) {
      noticeTimer = setTimeout(function () { $('notice').textContent = ''; }, 6000);
    }
  }

  function soundName(which, index, chordCfg) {
    if (which === 'drums') return synth.drumNames[index];
    if (which === 'earshot') return effects[index];
    if (chordCfg && chordCfg.chord && chordCfg.chord !== 'off') return model.chordLabel(index, chordCfg);
    return model.noteName(index);
  }

  function padSubtitle(assignment, modeCfg) {
    if (assignment.bank === 'drums') return synth.drumTypes[assignment.index];
    if (assignment.bank === 'earshot') return effectTypes[assignment.index];
    var cfg = assignment.bank === state.mode ? modeCfg : { root: 0, scale: 'chromatic', chord: 'off' };
    if (cfg && cfg.chord && cfg.chord !== 'off') {
      return model.chordNotes(assignment.index, cfg).map(model.noteName).join(' · ');
    }
    var tuneTag = assignment.tune ? ((assignment.tune > 0 ? '+' : '') + assignment.tune + 'ST') : '';
    return model.names[assignment.bank].toUpperCase() + (tuneTag ? ' · ' + tuneTag : '');
  }

  function waveform(bank, index) {
    var bars = synth.waveformBars(bank, index, 22);
    var lines = '';
    for (var i = 0; i < bars.length; i++) {
      var h = bars[i];
      lines += '<path d="M' + (i * 2.8 + 1.5).toFixed(1) + ' ' + (13 - h / 2).toFixed(1) + 'v' + h + '"/>';
    }
    return '<svg viewBox="0 0 64 26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">' + lines + '</svg>';
  }

  function findTrack(assignment, slot) {
    for (var i = 0; i < state.tracks.length; i++) {
      var t = state.tracks[i];
      if (t.bank === assignment.bank && t.index === assignment.index) return t;
      if (t.board === state.mode && t.slot === slot && t.bank === assignment.bank) return t;
    }
    return null;
  }

  function renderSteps() {
    var limit = state.size * state.size;
    if (selectedSlot >= limit) selectedSlot = 0;
    var pad = state.boards[state.mode][selectedSlot] || state.boards[state.mode][0];
    var cfg = state.settings[state.mode];
    var activeTrack = pad ? findTrack(pad, selectedSlot) : null;
    var label = pad ? soundName(pad.bank, pad.index, pad.bank === state.mode ? cfg : null) : 'Pad';
    $('seq-track').textContent = 'TRACK · ' + String(selectedSlot + 1).padStart(2, '0') + ' ' + label.toUpperCase();

    var html = '';
    for (var s = 0; s < 16; s++) {
      var val = activeTrack ? activeTrack.steps[s] : 0;
      var other = state.tracks.some(function (t) { return t !== activeTrack && t.steps[s] > 0; });
      var cls = 'step-btn' +
        (val === 1 ? ' on' : val === 2 ? ' accent' : '') +
        (other ? ' other' : '') +
        (seqPlaying && displayedStep === s ? ' current' : '');
      var group = Math.floor(s / 4);
      html += '<button type="button" class="' + cls + '" data-step="' + s + '" data-group="' + group + '" aria-label="Step ' + (s + 1) + (val ? ', active' : '') + '" aria-pressed="' + (val > 0) + '"><span class="step-led"></span><span>' + String(s + 1).padStart(2, '0') + '</span><span class="step-other"></span></button>';
    }
    $('steps').innerHTML = html;
    $('groove').value = state.groove;
    $('bpm').value = state.bpm;
    $('swing').value = state.swing;
    $('swing-value').textContent = state.swing + '%';
    $('metronome').setAttribute('aria-pressed', String(state.metronome));
  }

  function renderPads() {
    var limit = state.size * state.size;
    if (selectedSlot >= limit) selectedSlot = 0;
    var pads = state.boards[state.mode].slice(0, limit);
    var cfg = state.settings[state.mode];
    var isMelodic = model.melodic(state.mode);

    $('pads').style.setProperty('--grid-size', state.size);
    $('pads').dataset.size = state.size;

    $('pads').innerHTML = pads.map(function (assignment, i) {
      var chordCfg = assignment.bank === state.mode && isMelodic ? cfg : null;
      var name = soundName(assignment.bank, assignment.index, chordCfg);
      var sub = padSubtitle(assignment, cfg);
      var key = keys[i];
      var trk = findTrack(assignment, i);
      var hasSteps = Boolean(trk && trk.steps.some(Boolean));
      var selected = i === selectedSlot;
      return '<button type="button" class="pad' + (selected ? ' selected-pad' : '') + '" style="--color:' + colors[assignment.bank] + '" data-pad="' + i + '" aria-label="Pad ' + (i + 1) + ', ' + model.names[assignment.bank] + ', ' + name + (key ? ', key ' + key.toUpperCase() : '') + '">' +
        '<span class="pad-top"><span class="pad-num-wrap"><span>' + String(i + 1).padStart(2, '0') + '</span>' + (hasSteps ? '<i class="seq-pip" title="Active in sequencer"></i>' : '') + '</span>' + (key ? '<kbd>' + key.toUpperCase() + '</kbd>' : '') + '</span>' +
        '<span class="pad-bottom"><span class="pad-name">' + name + '</span>' +
        (assignment.bank !== state.mode ? '<span class="pad-instrument">' + model.names[assignment.bank] + '</span>' : '<span class="pad-sub">' + sub + '</span>') +
        '</span>' +
        waveform(assignment.bank, assignment.index) +
        '</button>';
    }).join('');

    var chordBadge = isMelodic && cfg.chord !== 'off' ? ' · ' + cfg.chord.toUpperCase() : '';
    $('bank-meta').textContent = pads.length + ' PADS · ' + model.names[state.mode].toUpperCase() + chordBadge;
    $('mode').value = state.mode;
    $('grid-size').value = state.size;
    $('root-note').value = cfg.root;
    $('scale').value = cfg.scale;
    $('octave').value = cfg.octave;
    $('chord-quick').value = cfg.chord;
    $('chord-quick').disabled = !isMelodic;
    $('chord-quick').parentElement.classList.toggle('disabled', !isMelodic);
    ['root-note', 'scale', 'octave'].forEach(function (id) { $(id).disabled = !isMelodic; });

    renderSteps();
    recordingUI();
    warmBoard();
  }

  function setMode(mode) {
    state.mode = mode;
    selectedSlot = 0;
    renderPads();
    save();
  }

  function createImpulse(ctx) {
    var length = Math.floor(ctx.sampleRate * 0.95);
    var buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    var rng = 123;
    for (var c = 0; c < 2; c++) {
      var data = buffer.getChannelData(c);
      for (var i = 0; i < length; i++) {
        rng = (Math.imul(rng, 1664525) + 1013904223) | 0;
        var decay = Math.pow(1 - i / length, 2.8);
        data[i] = (((rng >>> 0) / 4294967296) * 2 - 1) * decay;
      }
    }
    return buffer;
  }

  function applyFilterNode(filterNode, filterVal, atTime) {
    if (!filterNode) return;
    var t = atTime || 0;
    if (filterVal === 0) {
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(20000, t);
      filterNode.Q.setValueAtTime(0.5, t);
    } else if (filterVal < 0) {
      var lpFreq = 20000 * Math.pow(150 / 20000, Math.abs(filterVal) / 100);
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(lpFreq, t);
      filterNode.Q.setValueAtTime(1.55, t);
    } else {
      var hpFreq = 22 * Math.pow(2200 / 22, filterVal / 100);
      filterNode.type = 'highpass';
      filterNode.frequency.setValueAtTime(hpFreq, t);
      filterNode.Q.setValueAtTime(1.35, t);
    }
  }

  function syncDelayTime(chain, bpm, atTime) {
    if (!chain || !chain.delayL) return;
    var base = Math.max(0.11, Math.min(0.65, (60 / bpm) * 0.75));
    var t = atTime || 0;
    chain.delayL.delayTime.setValueAtTime(base, t);
    chain.delayR.delayTime.setValueAtTime(Math.min(0.95, base * 1.333), t);
  }

  function outputChain(ctx, bpm, filterVal) {
    var preBus = ctx.createGain();
    var filterNode = ctx.createBiquadFilter();
    var master = ctx.createGain();
    var limiter = ctx.createDynamicsCompressor();
    var room = ctx.createConvolver();

    var delayIn = ctx.createGain();
    var delayFilter = ctx.createBiquadFilter();
    var delayL = ctx.createDelay(1.0);
    var delayR = ctx.createDelay(1.0);
    var fbL = ctx.createGain();
    var fbR = ctx.createGain();
    var merger = ctx.createChannelMerger(2);
    var delayOut = ctx.createGain();

    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2300;
    fbL.gain.value = 0.34;
    fbR.gain.value = 0.32;
    delayOut.gain.value = 0.85;

    delayIn.connect(delayFilter);
    delayFilter.connect(delayL);
    delayFilter.connect(delayR);
    delayL.connect(fbL);
    fbL.connect(delayR);
    delayR.connect(fbR);
    fbR.connect(delayL);
    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);
    merger.connect(delayOut);
    delayOut.connect(preBus);

    room.buffer = impulse || createImpulse(ctx);
    room.connect(preBus);

    preBus.connect(filterNode);
    master.gain.value = 0.74;
    limiter.threshold.value = -5.5;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    filterNode.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);

    var chain = {
      bus: preBus,
      room: room,
      echo: delayIn,
      filter: filterNode,
      delayL: delayL,
      delayR: delayR,
      limiter: limiter,
      openHats: []
    };

    applyFilterNode(filterNode, filterVal, 0);
    syncDelayTime(chain, bpm, 0);
    return chain;
  }

  function unlock() {
    audioSession.activate();
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return Promise.reject(new Error('Web Audio unavailable'));
    if (!context) {
      context = new Audio({ latencyHint: 'interactive' });
      impulse = createImpulse(context);
      liveChain = outputChain(context, state.bpm, state.filter);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      liveChain.limiter.connect(analyser);
      context.onstatechange = function () {
        var active = context.state === 'running';
        $('power').classList.toggle('on', active);
        $('power-label').textContent = active ? 'Test audio' : 'Resume audio';
      };
    }
    var resume = context.resume();
    var silent = context.createBufferSource();
    silent.buffer = context.createBuffer(1, 1, 22050);
    silent.connect(context.destination);
    silent.start(0);
    startScope();
    return Promise.resolve(resume).then(function () {
      var active = context.state === 'running';
      $('power').classList.toggle('on', active);
      $('power-label').textContent = active ? 'Test audio' : 'Enable audio';
    });
  }

  function loadEffects() {
    if (buffers.earshot) return Promise.resolve();
    if (loadPromise) return loadPromise;
    notify('Loading Earshot SFX…');
    loadPromise = Promise.all(effects.map(function (_, i) {
      return fetch('./audio/' + String(i + 1).padStart(2, '0') + '.wav').then(function (response) {
        if (!response.ok) throw new Error('Sound download failed');
        return response.arrayBuffer();
      }).then(function (bytes) {
        return new Promise(function (resolve, reject) {
          context.decodeAudioData(bytes, resolve, reject);
        });
      });
    })).then(function (sounds) {
      buffers.earshot = sounds;
      notify('Earshot SFX ready.');
    }).catch(function (error) {
      loadPromise = null;
      throw error;
    });
    return loadPromise;
  }

  function bufferFor(which, index) {
    if (!buffers[which]) buffers[which] = [];
    if (!buffers[which][index] && which !== 'earshot') {
      var key = which + ':' + index;
      var voice = warmed[key] || synth.voice(which, index, 44100);
      var buffer = context.createBuffer(1, voice.data.length, voice.sampleRate);
      buffer.getChannelData(0).set(voice.data);
      buffers[which][index] = buffer;
      delete warmed[key];
    }
    return buffers[which][index];
  }

  function prepare(which, index) {
    return which === 'earshot' ? loadEffects() : Promise.resolve(bufferFor(which, index));
  }

  function playClick(when, accent) {
    if (!context || !liveChain) return;
    var osc = context.createOscillator();
    var gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 1320 : 880, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(accent ? 0.22 : 0.12, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    osc.connect(gain);
    gain.connect(liveChain.bus);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  function flash(slot, which, delay) {
    if (slot < 0) return;
    if (delay > 2) {
      var timer = setTimeout(function () {
        visualTimers.delete(timer);
        flash(slot, which, 0);
      }, delay);
      visualTimers.add(timer);
      return;
    }
    $('hit-led').classList.add('pulse');
    clearTimeout(hitLedTimer);
    hitLedTimer = setTimeout(function () { $('hit-led').classList.remove('pulse'); }, 110);
    if (which !== state.mode) return;
    var pad = $('pads').children[slot];
    if (!pad) return;
    pad.classList.add('hit');
    clearTimeout(hitTimers[slot]);
    hitTimers[slot] = setTimeout(function () { pad.classList.remove('hit'); }, 115);
  }

  function connectVoice(ctx, chain, bank, noteIndex, pitch, gainVal, roomVal, delayVal, when) {
    var buffer = bufferFor(bank, noteIndex);
    if (!buffer) return null;

    if (bank === 'drums' && noteIndex === 2 && chain.openHats.length) {
      chain.openHats.forEach(function (oh) {
        if (oh.start <= when + 0.005 && !oh.choked) {
          oh.choked = true;
          var t0 = Math.max(oh.start + 0.002, when);
          try {
            oh.gain.gain.setValueAtTime(oh.level, t0);
            oh.gain.gain.linearRampToValueAtTime(0.0001, t0 + 0.014);
            oh.source.stop(t0 + 0.018);
          } catch (_) {}
        }
      });
      chain.openHats = chain.openHats.filter(function (oh) { return !oh.choked; });
    }

    var source = ctx.createBufferSource();
    var gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = Math.pow(2, pitch / 12);
    gain.gain.setValueAtTime(gainVal, when);
    source.connect(gain);
    gain.connect(chain.bus);

    var sendRoom = null, sendEcho = null;
    if (roomVal > 0.001) {
      sendRoom = ctx.createGain();
      sendRoom.gain.value = roomVal;
      gain.connect(sendRoom);
      sendRoom.connect(chain.room);
    }
    if (delayVal > 0.001) {
      sendEcho = ctx.createGain();
      sendEcho.gain.value = delayVal;
      gain.connect(sendEcho);
      sendEcho.connect(chain.echo);
    }

    if (bank === 'drums' && noteIndex === 3) {
      chain.openHats.push({ source: source, gain: gain, start: when, level: gainVal, choked: false });
      if (chain.openHats.length > 8) chain.openHats.shift();
    }

    source.start(when);
    return { source: source, gain: gain, sendRoom: sendRoom, sendEcho: sendEcho };
  }

  function scheduleEvent(ctx, chain, event, baseWhen, live) {
    var notes = event.notes && event.notes.length ? event.notes : [event.index];
    var chordScale = 1 / Math.pow(notes.length, 0.42);
    var totalPitch = (event.pitch || 0) + (event.tune || 0);
    var finalGain = event.volume * (event.gain || 1) * (event.vel || 1) * chordScale;

    notes.forEach(function (noteIdx, i) {
      var when = baseWhen + i * 0.010;
      if (live && sources.size >= 56) {
        var oldest = sources.values().next().value;
        try { oldest.stop(); } catch (_) {}
        sources.delete(oldest);
      }
      var node = connectVoice(ctx, chain, event.bank, noteIdx, totalPitch, finalGain, event.room, event.delay || 0, when);
      if (node && live) {
        sources.add(node.source);
        node.source.onended = function () {
          sources.delete(node.source);
          try {
            node.source.disconnect();
            node.gain.disconnect();
            if (node.sendRoom) node.sendRoom.disconnect();
            if (node.sendEcho) node.sendEcho.disconnect();
          } catch (_) {}
        };
      }
    });

    if (live) {
      startScope();
      flash(event.slot, event.board, Math.max(0, (baseWhen - context.currentTime) * 1000));
    }
  }

  function buildEvent(assignment, slot, vel) {
    var cfg = state.settings[state.mode];
    var useChord = model.melodic(assignment.bank) && assignment.bank === state.mode && cfg.chord !== 'off';
    var notes = useChord ? model.chordNotes(assignment.index, cfg) : [assignment.index];
    var recTime = 0;
    if (recording && context) {
      if (overdubbing && looping && takeLength > 0) {
        recTime = (context.currentTime - currentLoopOrigin) % takeLength;
        if (recTime < 0) recTime += takeLength;
      } else {
        recTime = Math.max(0, context.currentTime - recordStart);
      }
      if (state.quantize) {
        var stepGrid = (60 / state.bpm) / 4;
        recTime = Math.round(recTime / stepGrid) * stepGrid;
        if (overdubbing && takeLength > 0 && recTime >= takeLength) recTime = 0;
      }
    }
    return {
      bank: assignment.bank,
      index: assignment.index,
      notes: notes,
      board: state.mode,
      slot: slot,
      pitch: state.pitch,
      tune: assignment.tune || 0,
      gain: assignment.gain || 1,
      vel: vel || 1,
      volume: state.volume,
      room: state.room,
      delay: state.delay,
      layer: currentLayer,
      time: recTime
    };
  }

  function selectPadTrack(slot) {
    if (slot < 0 || slot === selectedSlot) return;
    var prev = $('pads').children[selectedSlot];
    if (prev) prev.classList.remove('selected-pad');
    selectedSlot = slot;
    var next = $('pads').children[selectedSlot];
    if (next) next.classList.add('selected-pad');
    renderSteps();
  }

  function hit(slot, vel) {
    if (editing) {
      openEditor(slot);
      return;
    }
    var assignment = state.boards[state.mode][slot];
    if (!assignment) return;
    selectPadTrack(slot);

    if (!context || context.state !== 'running') {
      if (audioStarting) return;
      audioStarting = unlock().then(function () {
        audioStarting = null;
        hit(slot, vel);
      }).catch(function () {
        audioStarting = null;
        notify('Tap Enable audio to retry.');
      });
      return;
    }

    if (assignment.bank === 'earshot' && !buffers.earshot) {
      prepare('earshot').then(function () { hit(slot, vel); }).catch(function () {
        notify('Earshot SFX could not load. Check your connection and tap again.');
      });
      return;
    }

    var cfg = state.settings[state.mode];
    var event = buildEvent(assignment, slot, vel || 1);
    scheduleEvent(context, liveChain, event, context.currentTime, true);

    var label = soundName(assignment.bank, assignment.index, assignment.bank === state.mode && model.melodic(assignment.bank) ? cfg : null);
    $('now-playing').textContent = String(slot + 1).padStart(2, '0') + ' · ' + label;

    if (recording) {
      take.push(event);
      if (overdubbing) recordingUI();
    }
  }

  /* Hold-to-Roll Note Repeat */
  function effectiveRoll() {
    return rollSubdiv > 0 ? rollSubdiv : (shiftHeld ? 4 : 0);
  }

  function rollIntervalMs() {
    var sub = effectiveRoll();
    if (!sub) return 0;
    return Math.max(42, ((60 / state.bpm) * (4 / sub)) * 1000);
  }

  function startRollEntry(entry) {
    clearInterval(entry.timer);
    var ms = rollIntervalMs();
    if (!ms || editing) return;
    entry.timer = setInterval(function () {
      hit(entry.slot, 0.88);
    }, ms);
  }

  function refreshActiveRolls() {
    activePointers.forEach(function (entry) { startRollEntry(entry); });
    activeKeys.forEach(function (entry) { startRollEntry(entry); });
  }

  function clearRolls() {
    activePointers.forEach(function (entry) { clearInterval(entry.timer); });
    activePointers.clear();
    activeKeys.forEach(function (entry) { clearInterval(entry.timer); });
    activeKeys.clear();
  }

  /* 16-Step Sequencer Engine */
  function trackToEvent(track, stepVal) {
    var notes = [track.index];
    if (model.melodic(track.bank)) {
      var chordMode = track.chord || (track.bank === state.mode ? state.settings[state.mode].chord : 'off');
      if (chordMode && chordMode !== 'off') {
        var scaleName = track.scale || (track.bank === state.mode ? state.settings[state.mode].scale : 'dorian');
        var rootNote = typeof track.root === 'number' ? track.root : (track.bank === state.mode ? state.settings[state.mode].root : 0);
        notes = model.chordNotes(track.index, { root: rootNote, scale: scaleName, chord: chordMode });
      }
    }
    return {
      bank: track.bank,
      index: track.index,
      notes: notes,
      board: track.board || track.bank,
      slot: typeof track.slot === 'number' ? track.slot : -1,
      pitch: state.pitch,
      tune: track.tune || 0,
      gain: track.gain || 1,
      vel: stepVal === 2 ? 1.1 : 0.84,
      volume: state.volume,
      room: state.room,
      delay: state.delay
    };
  }

  function highlightPlayhead(step, delayMs) {
    var run = function () {
      displayedStep = step;
      var children = $('steps').children;
      for (var i = 0; i < children.length; i++) {
        children[i].classList.toggle('current', seqPlaying && i === step);
      }
    };
    if (delayMs > 4) {
      var t = setTimeout(function () {
        visualTimers.delete(t);
        run();
      }, delayMs);
      visualTimers.add(t);
    } else {
      run();
    }
  }

  function schedulerTick() {
    if (!seqPlaying || !context) return;
    var now = context.currentTime;
    var stepDur = (60 / state.bpm) / 4;
    if (nextStepBase < now - 0.12) nextStepBase = now + 0.02;

    while (nextStepBase < now + 0.11) {
      var s = seqStep;
      var swingOffset = (s % 2 === 1) ? (state.swing / 100) * stepDur * 0.62 : 0;
      var fireAt = nextStepBase + swingOffset;

      if (state.metronome && s % 4 === 0) {
        playClick(fireAt, s === 0);
      }

      for (var i = 0; i < state.tracks.length; i++) {
        var trk = state.tracks[i];
        var val = trk.steps[s];
        if (val > 0) {
          if (trk.bank === 'earshot' && !buffers.earshot) continue;
          scheduleEvent(context, liveChain, trackToEvent(trk, val), fireAt, true);
        }
      }

      highlightPlayhead(s, Math.max(0, (fireAt - now) * 1000));
      seqStep = (seqStep + 1) % 16;
      nextStepBase += stepDur;
    }
    seqTimer = setTimeout(schedulerTick, 25);
  }

  function updateSeqUI() {
    $('seq-play').setAttribute('aria-pressed', String(seqPlaying));
    $('seq-play-label').textContent = seqPlaying ? '■ Stop' : '▷ Run';
    if (!seqPlaying) {
      displayedStep = -1;
      var children = $('steps').children;
      for (var i = 0; i < children.length; i++) children[i].classList.remove('current');
    }
  }

  function startSequencer() {
    unlock().then(function () {
      var needsEarshot = state.tracks.some(function (t) { return t.bank === 'earshot' && t.steps.some(Boolean); });
      return needsEarshot ? loadEffects() : Promise.resolve();
    }).then(function () {
      if (seqPlaying) return;
      seqPlaying = true;
      seqStep = 0;
      nextStepBase = context.currentTime + 0.035;
      updateSeqUI();
      schedulerTick();
    }).catch(function () {
      notify('Enable audio to run the sequencer.');
    });
  }

  function stopSequencer() {
    seqPlaying = false;
    clearTimeout(seqTimer);
    updateSeqUI();
  }

  /* Transport & Overdub Looper */
  function formatTime(time) {
    return String(Math.floor(time / 60)).padStart(2, '0') + ':' + (time % 60).toFixed(1).padStart(4, '0');
  }

  function hasExportableAudio() {
    return take.length > 0 || state.tracks.some(function (t) { return t.steps.some(Boolean); });
  }

  function layerSetCount() {
    var seen = new Set();
    take.forEach(function (e) { seen.add(e.layer || 0); });
    return seen.size;
  }

  function recordingUI() {
    var hasTake = take.length > 0;
    var layers = layerSetCount();
    $('record').classList.toggle('active', recording);
    $('record-label').textContent = recording ? 'Finish' : (hasTake ? 'Overdub' : 'Record');
    $('record').setAttribute('aria-label', recording ? 'Finish recording' : (hasTake ? 'Overdub new layer' : 'Start recording'));
    $('take-state').textContent = recording
      ? (overdubbing ? 'OVERDUB · L' + currentLayer : 'REC · 30s MAX')
      : hasTake
        ? (take.length + ' HITS · ' + layers + (layers === 1 ? ' LAYER' : ' LAYERS'))
        : (seqPlaying ? 'SEQ · ' + state.bpm + ' BPM' : 'READY');
    $('download').disabled = !hasExportableAudio() || recording || exporting;
    $('loop').disabled = !hasTake || (recording && !overdubbing);
    $('undo-take').disabled = !hasTake || recording;
    $('clear-take').disabled = !hasTake || recording;
    $('quantize').setAttribute('aria-pressed', String(state.quantize));
  }

  function tick() {
    if (!recording) return;
    if (overdubbing && looping && takeLength > 0) {
      var phase = (context.currentTime - currentLoopOrigin) % takeLength;
      $('timer').textContent = formatTime(Math.max(0, phase));
      recordFrame = requestAnimationFrame(tick);
      return;
    }
    var elapsed = context.currentTime - recordStart;
    $('timer').textContent = formatTime(elapsed);
    if (elapsed >= 30) {
      finishRecording();
      return;
    }
    recordFrame = requestAnimationFrame(tick);
  }

  function scheduleLoop() {
    if (!looping || !takeLength) return;
    var now = context.currentTime;
    if (nextLoop < now - 0.1) {
      nextLoop = now + 0.04;
      currentLoopOrigin = nextLoop;
    }
    while (nextLoop < now + 0.12) {
      currentLoopOrigin = nextLoop;
      var passStart = nextLoop;
      take.forEach(function (event) {
        if (event.time < takeLength) {
          scheduleEvent(context, liveChain, event, passStart + event.time, true);
        }
      });
      nextLoop += takeLength;
    }
    loopTimer = setTimeout(scheduleLoop, 40);
  }

  function startLoopPlayback() {
    if (!take.length || !takeLength) return;
    looping = true;
    nextLoop = context.currentTime + 0.04;
    currentLoopOrigin = nextLoop;
    $('loop').setAttribute('aria-pressed', 'true');
    scheduleLoop();
  }

  function finishRecording() {
    if (!recording) return;
    var wasOverdub = overdubbing;
    recording = false;
    overdubbing = false;
    cancelAnimationFrame(recordFrame);

    if (!wasOverdub) {
      var rawLen = context.currentTime - recordStart;
      if (seqPlaying) {
        var barDur = (60 / state.bpm) * 4;
        var bars = Math.max(1, Math.round(rawLen / barDur));
        takeLength = Math.min(30, bars * barDur);
      } else {
        takeLength = Math.max(0.25, Math.min(30, rawLen));
      }
      $('timer').textContent = formatTime(takeLength);
      if (!take.length) {
        takeLength = 0;
        notify('No hits recorded.');
      } else if (seqPlaying) {
        startLoopPlayback();
      }
    } else {
      $('timer').textContent = formatTime(takeLength);
    }
    recordingUI();
  }

  function stopAll() {
    clearRolls();
    looping = false;
    clearTimeout(loopTimer);
    $('loop').setAttribute('aria-pressed', 'false');
    stopSequencer();
    visualTimers.forEach(clearTimeout);
    visualTimers.clear();
    sources.forEach(function (source) {
      try { source.stop(); } catch (_) {}
    });
    sources.clear();
    if (liveChain) liveChain.openHats = [];
    if (recording) finishRecording();
    Array.prototype.forEach.call($('pads').children, function (pad) { pad.classList.remove('hit'); });
    recordingUI();
  }

  /* Live OLED Scope & VU Meter */
  function drawIdleScope(ctx2d, w, h) {
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.strokeStyle = 'rgba(110, 168, 130, 0.14)';
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    for (var x = 0; x < w; x += Math.max(18, Math.floor(w / 8))) {
      ctx2d.moveTo(x + 0.5, 4);
      ctx2d.lineTo(x + 0.5, h - 4);
    }
    ctx2d.moveTo(0, h / 2);
    ctx2d.lineTo(w, h / 2);
    ctx2d.stroke();
  }

  function startScope() {
    if (reducedMotion || scopeRaf || !analyser) return;
    silentFrames = 0;
    var canvas = $('scope');
    var ctx2d = canvas.getContext('2d');
    var timeData = new Uint8Array(analyser.fftSize);
    var freqData = new Uint8Array(analyser.frequencyBinCount);

    function frame() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.floor(canvas.clientWidth * dpr) || 220;
      var h = Math.floor(canvas.clientHeight * dpr) || 36;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      analyser.getByteTimeDomainData(timeData);
      var peak = 0;
      for (var i = 0; i < timeData.length; i++) {
        var amp = Math.abs(timeData[i] - 128) / 128;
        if (amp > peak) peak = amp;
      }

      var vuL = Math.min(100, Math.max(10, Math.round(peak * 155)));
      var vuR = Math.min(100, Math.max(10, Math.round(peak * 142 + (peak > 0.02 ? 6 : 0))));
      $('vu-l').style.height = vuL + '%';
      $('vu-r').style.height = vuR + '%';

      drawIdleScope(ctx2d, w, h);

      if (scopeMode === 'wave') {
        ctx2d.strokeStyle = peak > 0.01 ? '#87f09a' : 'rgba(135, 240, 154, 0.45)';
        ctx2d.lineWidth = 1.6 * dpr;
        ctx2d.beginPath();
        var slice = w / (timeData.length - 1);
        for (var j = 0; j < timeData.length; j++) {
          var v = (timeData[j] - 128) / 128;
          var y = h / 2 + v * (h * 0.44);
          if (j === 0) ctx2d.moveTo(0, y);
          else ctx2d.lineTo(j * slice, y);
        }
        ctx2d.stroke();
      } else {
        analyser.getByteFrequencyData(freqData);
        var bars = 28;
        var step = Math.floor(freqData.length * 0.72 / bars) || 1;
        var bw = (w / bars) - 1.5 * dpr;
        for (var b = 0; b < bars; b++) {
          var mag = freqData[b * step] / 255;
          var bh = Math.max(1.5 * dpr, mag * (h - 4 * dpr));
          ctx2d.fillStyle = mag > 0.7 ? '#f59e4b' : '#7ee492';
          ctx2d.fillRect(b * (w / bars) + 0.8 * dpr, h - bh - 1 * dpr, Math.max(1.5, bw), bh);
        }
      }

      if (peak < 0.006 && sources.size === 0 && !seqPlaying && !looping) {
        silentFrames++;
        if (silentFrames > 65) {
          scopeRaf = null;
          $('vu-l').style.height = '10%';
          $('vu-r').style.height = '10%';
          drawIdleScope(ctx2d, w, h);
          return;
        }
      } else {
        silentFrames = 0;
      }
      scopeRaf = requestAnimationFrame(frame);
    }

    scopeRaf = requestAnimationFrame(frame);
  }

  /* Pad Assignment Editor */
  function editMode(enabled) {
    editing = enabled;
    $('edit-pads').setAttribute('aria-pressed', String(enabled));
    $('pads').classList.toggle('editing', enabled);
    $('edit-hint').hidden = !enabled;
  }

  function editorOptions(selected) {
    var which = $('pad-instrument').value;
    var count = model.melodic(which) ? 96 : 16;
    $('pad-sound').innerHTML = Array.from({ length: count }, function (_, i) {
      return '<option value="' + i + '">' + soundName(which, i) + '</option>';
    }).join('');
    $('pad-sound').value = selected === undefined ? (model.melodic(which) ? 24 : 0) : selected;
  }

  function updateEditorSliders(tune, gainPct) {
    $('pad-tune').value = tune;
    $('pad-tune-value').textContent = (tune > 0 ? '+' : '') + tune + ' st';
    $('pad-gain').value = gainPct;
    $('pad-gain-value').textContent = gainPct + '%';
  }

  function openEditor(slot) {
    editorIndex = slot;
    focusBeforeEditor = document.activeElement;
    var pad = state.boards[state.mode][slot];
    $('editor-title').textContent = 'Pad ' + String(slot + 1).padStart(2, '0');
    $('pad-instrument').value = pad.bank;
    editorOptions(pad.index);
    updateEditorSliders(pad.tune || 0, Math.round((pad.gain || 1) * 100));
    $('pad-editor').hidden = false;
    $('pad-instrument').focus();
  }

  function closeEditor() {
    $('pad-editor').hidden = true;
    editorIndex = null;
    if (focusBeforeEditor && document.contains(focusBeforeEditor)) focusBeforeEditor.focus();
    else $('edit-pads').focus();
  }

  /* Pad Pointer Events (Multi-Touch + Glide Strum + Roll) */
  if (window.PointerEvent) {
    $('pads').addEventListener('pointerdown', function (event) {
      var pad = event.target.closest('[data-pad]');
      if (!pad || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (state.size <= 4 || event.pointerType === 'mouse') event.preventDefault();
      var slot = Number(pad.dataset.pad);
      hit(slot, 1);
      var entry = { slot: slot, timer: null };
      activePointers.set(event.pointerId, entry);
      startRollEntry(entry);
    }, { passive: false });

    window.addEventListener('pointermove', function (event) {
      var entry = activePointers.get(event.pointerId);
      if (!entry || editing) return;
      if (state.size > 4 && event.pointerType !== 'mouse') return;
      var el = document.elementFromPoint(event.clientX, event.clientY);
      var pad = el && el.closest && el.closest('[data-pad]');
      if (!pad) return;
      var nextSlot = Number(pad.dataset.pad);
      if (nextSlot !== entry.slot) {
        entry.slot = nextSlot;
        hit(nextSlot, 0.92);
        startRollEntry(entry);
      }
    });

    var endPointer = function (event) {
      var entry = activePointers.get(event.pointerId);
      if (!entry) return;
      clearInterval(entry.timer);
      activePointers.delete(event.pointerId);
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  } else {
    $('pads').addEventListener('touchstart', function (event) {
      var pad = event.target.closest('[data-pad]');
      if (!pad) return;
      event.preventDefault();
      hit(Number(pad.dataset.pad), 1);
    }, { passive: false });
    $('pads').addEventListener('mousedown', function (event) {
      var pad = event.target.closest('[data-pad]');
      if (pad && event.button === 0) {
        event.preventDefault();
        hit(Number(pad.dataset.pad), 1);
      }
    });
  }

  $('pads').addEventListener('click', function (event) {
    if (event.detail !== 0) return;
    var pad = event.target.closest('[data-pad]');
    if (pad) hit(Number(pad.dataset.pad), 1);
  });

  /* Keyboard Performance, Spacebar Run, Shift-Roll, Focus Trap */
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Shift' && !shiftHeld) {
      shiftHeld = true;
      refreshActiveRolls();
    }
    if (!$('pad-editor').hidden) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditor();
      }
      if (event.key === 'Tab') {
        var focusable = $('pad-editor').querySelectorAll('button,select,input');
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === 'Escape') {
      stopAll();
      return;
    }
    if (event.code === 'Space' && event.target.tagName !== 'BUTTON') {
      event.preventDefault();
      if (!event.repeat) {
        if (seqPlaying) stopSequencer();
        else startSequencer();
      }
      return;
    }
    if (event.repeat) return;
    var slot = keys.indexOf(event.key.toLowerCase());
    if (slot >= 0 && slot < state.size * state.size) {
      event.preventDefault();
      hit(slot, 1);
      var kEntry = { slot: slot, timer: null };
      activeKeys.set(event.key.toLowerCase(), kEntry);
      startRollEntry(kEntry);
    }
  });

  document.addEventListener('keyup', function (event) {
    if (event.key === 'Shift') {
      shiftHeld = false;
      refreshActiveRolls();
      return;
    }
    var k = event.key.toLowerCase();
    var entry = activeKeys.get(k);
    if (entry) {
      clearInterval(entry.timer);
      activeKeys.delete(k);
    }
  });

  window.addEventListener('blur', clearRolls);

  /* Roll Rate Selector */
  document.querySelector('.roll-strip').addEventListener('click', function (event) {
    var btn = event.target.closest('[data-roll]');
    if (!btn) return;
    rollSubdiv = Number(btn.dataset.roll);
    Array.prototype.forEach.call(this.querySelectorAll('[data-roll]'), function (el) {
      el.setAttribute('aria-pressed', String(el === btn));
    });
    refreshActiveRolls();
  });

  /* Scope & Share */
  $('scope-toggle').addEventListener('click', function () {
    scopeMode = scopeMode === 'wave' ? 'spec' : 'wave';
    $('scope-mode').textContent = scopeMode === 'wave' ? 'SCOPE' : 'SPEC';
    startScope();
  });

  $('share-board').addEventListener('click', function () {
    var hash = '#' + model.encodeShare(state);
    var url = location.origin + location.pathname + hash;
    try { history.replaceState(null, '', hash); } catch (_) {}
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        notify('Shareable board & groove link copied to clipboard.');
      }).catch(function () {
        notify('URL updated in address bar — copy it to share.');
      });
    } else {
      notify('URL updated in address bar — copy it to share.');
    }
  });

  /* Power / Audio Check */
  $('power').addEventListener('click', function () {
    unlock().then(function () {
      if (state.volume === 0) {
        notify('Volume is at 0%. Raise the soundboard volume to hear it.');
        return;
      }
      scheduleEvent(context, liveChain, {
        bank: 'keys',
        index: 36,
        notes: [36, 43],
        board: state.mode,
        slot: -1,
        pitch: 0,
        volume: Math.min(state.volume, 0.5),
        room: 0.12,
        delay: 0
      }, context.currentTime, true);
      if (state.mode === 'earshot') return loadEffects();
    }).catch(function () {
      notify('Audio could not start. Tap to retry.');
    });
  });

  /* Bank, Chord, Grid, Settings */
  $('mode').addEventListener('change', function () { setMode(this.value); });
  $('previous-mode').addEventListener('click', function () {
    setMode(model.modes[(model.modes.indexOf(state.mode) + model.modes.length - 1) % model.modes.length]);
  });
  $('next-mode').addEventListener('click', function () {
    setMode(model.modes[(model.modes.indexOf(state.mode) + 1) % model.modes.length]);
  });

  $('chord-quick').addEventListener('change', function () {
    if (!model.melodic(state.mode)) return;
    state.settings[state.mode].chord = this.value;
    renderPads();
    save();
  });

  $('grid-size').addEventListener('change', function () {
    state.size = Number(this.value);
    renderPads();
    save();
  });

  $('seq-toggle').addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    $('sequencer').hidden = open;
  });

  $('edit-pads').addEventListener('click', function () { editMode(!editing); });
  $('done-edit').addEventListener('click', function () { editMode(false); });

  $('settings-button').addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    $('settings').hidden = open;
  });

  ['root-note', 'scale', 'octave'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var config = state.settings[state.mode];
      config.root = Number($('root-note').value);
      config.scale = $('scale').value;
      config.octave = Number($('octave').value);
      state.boards[state.mode] = state.boards[state.mode].map(function (pad, i) {
        return pad.bank === state.mode ? model.defaultPad(state.mode, i, config) : pad;
      });
      renderPads();
      save();
    });
  });

  $('reset-board').addEventListener('click', function () {
    state.boards[state.mode] = Array.from({ length: 64 }, function (_, i) {
      return model.defaultPad(state.mode, i, state.settings[state.mode]);
    });
    renderPads();
    save();
    notify(model.names[state.mode] + ' layout reset.');
  });

  /* Sequencer Step & Groove Controls */
  $('seq-play').addEventListener('click', function () {
    if (seqPlaying) stopSequencer();
    else startSequencer();
  });

  function applyGroovePreset(key, autoPlay) {
    if (!model.grooves[key]) return;
    var preset = model.grooves[key];
    state.groove = key;
    state.bpm = preset.bpm;
    state.swing = preset.swing;
    state.tracks = model.cloneGrooveTracks(key);
    if (liveChain && context) syncDelayTime(liveChain, state.bpm, context.currentTime);
    renderPads();
    save();
    if (autoPlay) startSequencer();
  }

  $('groove').addEventListener('change', function () {
    if (this.value === 'custom') {
      state.groove = 'custom';
      save();
      return;
    }
    applyGroovePreset(this.value, seqPlaying);
  });

  function setBpm(nextBpm) {
    state.bpm = Math.max(60, Math.min(180, Math.round(nextBpm || 104)));
    $('bpm').value = state.bpm;
    if (liveChain && context) syncDelayTime(liveChain, state.bpm, context.currentTime);
    refreshActiveRolls();
    recordingUI();
    save();
  }

  $('bpm').addEventListener('change', function () { setBpm(Number(this.value)); });
  $('bpm-down').addEventListener('click', function () { setBpm(state.bpm - 2); });
  $('bpm-up').addEventListener('click', function () { setBpm(state.bpm + 2); });

  $('tap-tempo').addEventListener('click', function () {
    var now = performance.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 2600; });
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      var sum = 0;
      for (var i = 1; i < tapTimes.length; i++) sum += tapTimes[i] - tapTimes[i - 1];
      var avgMs = sum / (tapTimes.length - 1);
      setBpm(60000 / avgMs);
    }
  });

  $('swing').addEventListener('input', function () {
    state.swing = Number(this.value);
    $('swing-value').textContent = state.swing + '%';
    save();
  });

  $('metronome').addEventListener('click', function () {
    state.metronome = !state.metronome;
    this.setAttribute('aria-pressed', String(state.metronome));
    save();
  });

  $('seq-clear').addEventListener('click', function () {
    state.tracks = [];
    state.groove = 'custom';
    renderPads();
    save();
    notify('Sequencer pattern cleared.');
  });

  $('steps').addEventListener('click', function (event) {
    var btn = event.target.closest('[data-step]');
    if (!btn) return;
    var s = Number(btn.dataset.step);
    var assignment = state.boards[state.mode][selectedSlot];
    if (!assignment) return;

    var trk = findTrack(assignment, selectedSlot);
    if (!trk) {
      if (state.tracks.length >= 24) {
        notify('Maximum 24 tracks reached. Clear pattern to free tracks.');
        return;
      }
      var cfg = state.settings[state.mode];
      trk = {
        bank: assignment.bank,
        index: assignment.index,
        board: state.mode,
        slot: selectedSlot,
        steps: Array(16).fill(0)
      };
      if (assignment.tune) trk.tune = assignment.tune;
      if (assignment.gain && assignment.gain !== 1) trk.gain = assignment.gain;
      if (model.melodic(assignment.bank) && assignment.bank === state.mode && cfg.chord !== 'off') {
        trk.chord = cfg.chord;
        trk.scale = cfg.scale;
        trk.root = cfg.root;
      }
      state.tracks.push(trk);
    }

    var current = trk.steps[s];
    if (event.shiftKey) {
      trk.steps[s] = current === 2 ? 0 : 2;
    } else {
      trk.steps[s] = current > 0 ? 0 : 1;
    }

    if (!trk.steps.some(Boolean)) {
      state.tracks = state.tracks.filter(function (t) { return t !== trk; });
    }
    state.groove = 'custom';
    if (assignment.bank === 'earshot' && context && !buffers.earshot && trk.steps[s] > 0) {
      loadEffects().catch(function () {});
    }
    renderPads();
    save();
  });

  /* Pad Editor Handlers */
  $('pad-instrument').addEventListener('change', function () { editorOptions(); });
  $('editor-close').addEventListener('click', closeEditor);
  $('pad-editor').addEventListener('click', function (event) { if (event.target === this) closeEditor(); });

  $('pad-tune').addEventListener('input', function () {
    var v = Number(this.value);
    $('pad-tune-value').textContent = (v > 0 ? '+' : '') + v + ' st';
  });
  $('pad-gain').addEventListener('input', function () {
    $('pad-gain-value').textContent = this.value + '%';
  });

  function currentEditorAssignment() {
    var obj = {
      bank: $('pad-instrument').value,
      index: Number($('pad-sound').value)
    };
    var tune = Number($('pad-tune').value);
    var gain = +(Number($('pad-gain').value) / 100).toFixed(2);
    if (tune !== 0) obj.tune = tune;
    if (gain !== 1) obj.gain = gain;
    return obj;
  }

  $('preview-pad').addEventListener('click', function () {
    var assignment = currentEditorAssignment();
    unlock().then(function () {
      return prepare(assignment.bank, assignment.index);
    }).then(function () {
      scheduleEvent(context, liveChain, buildEvent(assignment, -1, 1), context.currentTime, true);
    }).catch(function () {
      notify('Could not load this sound. Check your connection.');
    });
  });

  $('reset-pad').addEventListener('click', function () {
    if (editorIndex === null) return;
    var def = model.defaultPad(state.mode, editorIndex, state.settings[state.mode]);
    $('pad-instrument').value = def.bank;
    editorOptions(def.index);
    updateEditorSliders(0, 100);
  });

  $('save-pad').addEventListener('click', function () {
    if (editorIndex === null) return;
    var slot = editorIndex;
    state.boards[state.mode][slot] = currentEditorAssignment();
    closeEditor();
    renderPads();
    save();
    if ($('pads').children[slot]) $('pads').children[slot].focus();
  });

  /* Master Mixer Sliders + Interactive Rotary Knobs */
  function syncMixerVisuals() {
    $('volume-knob').style.setProperty('--rotation', (state.volume * 270 - 135) + 'deg');
    $('pitch-knob').style.setProperty('--rotation', (state.pitch / 12 * 135) + 'deg');
    $('filter-knob').style.setProperty('--rotation', (state.filter / 100 * 135) + 'deg');
    $('delay-knob').style.setProperty('--rotation', ((state.delay / 0.65) * 270 - 135) + 'deg');

    $('volume').value = Math.round(state.volume * 100);
    $('volume-value').textContent = Math.round(state.volume * 100) + '%';

    $('pitch').value = state.pitch;
    $('pitch-value').textContent = (state.pitch > 0 ? '+' : '') + state.pitch + ' st';

    $('filter').value = state.filter;
    $('filter-value').textContent = state.filter === 0 ? 'FLAT' : (state.filter < 0 ? 'LP ' + Math.abs(state.filter) + '%' : 'HP ' + state.filter + '%');

    $('delay').value = Math.round(state.delay * 100);
    $('delay-value').textContent = Math.round(state.delay * 100) + '%';

    $('room').value = Math.round(state.room * 100);
    $('room-value').textContent = Math.round(state.room * 100) + '%';
  }

  $('volume').addEventListener('input', function () {
    state.volume = Number(this.value) / 100;
    syncMixerVisuals();
    save();
  });

  $('pitch').addEventListener('input', function () {
    state.pitch = Number(this.value);
    syncMixerVisuals();
    save();
  });

  $('filter').addEventListener('input', function () {
    state.filter = Number(this.value);
    if (liveChain && context) applyFilterNode(liveChain.filter, state.filter, context.currentTime);
    syncMixerVisuals();
    save();
  });

  $('delay').addEventListener('input', function () {
    state.delay = Number(this.value) / 100;
    syncMixerVisuals();
    save();
  });

  $('room').addEventListener('input', function () {
    state.room = Number(this.value) / 100;
    syncMixerVisuals();
    save();
  });

  Array.prototype.forEach.call(document.querySelectorAll('.knob[data-for]'), function (knob) {
    var input = $(knob.dataset.for);
    if (!input) return;
    knob.addEventListener('dblclick', function (e) {
      e.preventDefault();
      input.value = knob.dataset.default;
      input.dispatchEvent(new Event('input'));
    });
    if (!window.PointerEvent) return;
    var drag = null;
    knob.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      knob.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, start: Number(input.value), min: Number(input.min), max: Number(input.max) };
    });
    knob.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var range = drag.max - drag.min;
      var delta = ((drag.y - e.clientY) / 130) * range;
      var val = Math.round(Math.max(drag.min, Math.min(drag.max, drag.start + delta)));
      if (val !== Number(input.value)) {
        input.value = val;
        input.dispatchEvent(new Event('input'));
      }
    });
    var endKnob = function () { drag = null; };
    knob.addEventListener('pointerup', endKnob);
    knob.addEventListener('pointercancel', endKnob);
  });

  /* Record, Overdub, Loop, Quantize, Undo, Clear, Export */
  $('record').addEventListener('click', function () {
    if (recording) {
      finishRecording();
      return;
    }
    $('record').disabled = true;
    $('record-label').textContent = 'Arming';
    unlock().then(function () {
      var needsEffects = state.boards[state.mode].slice(0, state.size * state.size).some(function (pad) {
        return pad.bank === 'earshot';
      });
      return needsEffects ? loadEffects() : Promise.resolve();
    }).then(function () {
      editMode(false);
      $('record').disabled = false;
      if (take.length > 0 && takeLength > 0) {
        currentLayer++;
        overdubbing = true;
        recording = true;
        if (!looping) startLoopPlayback();
      } else {
        currentLayer = 1;
        overdubbing = false;
        take = [];
        takeLength = 0;
        recording = true;
        recordStart = context.currentTime;
      }
      recordingUI();
      tick();
    }).catch(function () {
      $('record').disabled = false;
      recordingUI();
      notify('Could not start recording. Enable audio and retry.');
    });
  });

  $('quantize').addEventListener('click', function () {
    state.quantize = !state.quantize;
    recordingUI();
    save();
  });

  $('undo-take').addEventListener('click', function () {
    if (!take.length || recording) return;
    var maxLayer = take.reduce(function (m, e) { return Math.max(m, e.layer || 0); }, 0);
    take = take.filter(function (e) { return (e.layer || 0) < maxLayer; });
    if (!take.length) {
      takeLength = 0;
      looping = false;
      clearTimeout(loopTimer);
      $('loop').setAttribute('aria-pressed', 'false');
      $('timer').textContent = '00:00.0';
    }
    recordingUI();
    notify('Removed layer ' + maxLayer + '.');
  });

  $('clear-take').addEventListener('click', function () {
    if (recording) return;
    take = [];
    takeLength = 0;
    currentLayer = 0;
    looping = false;
    clearTimeout(loopTimer);
    $('loop').setAttribute('aria-pressed', 'false');
    $('timer').textContent = '00:00.0';
    recordingUI();
    notify('Recorded take cleared.');
  });

  $('stop').addEventListener('click', stopAll);

  $('loop').addEventListener('click', function () {
    if (looping) {
      looping = false;
      clearTimeout(loopTimer);
      $('loop').setAttribute('aria-pressed', 'false');
      if (recording && overdubbing) finishRecording();
      recordingUI();
      return;
    }
    unlock().then(function () {
      startLoopPlayback();
    }).catch(function () {
      notify('Enable audio to play your take.');
    });
  });

  $('download').addEventListener('click', function () {
    if (!hasExportableAudio() || exporting) return;
    var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) {
      notify('WAV export is unavailable in this browser.');
      return;
    }
    exporting = true;
    recordingUI();

    unlock().then(function () {
      var usesEarshot = take.some(function (e) { return e.bank === 'earshot'; }) ||
        state.tracks.some(function (t) { return t.bank === 'earshot' && t.steps.some(Boolean); });
      return usesEarshot ? loadEffects() : Promise.resolve();
    }).then(function () {
      var events = take.slice();
      var includeSeq = events.length === 0 || seqPlaying;
      var barDur = (60 / state.bpm) * 4;
      var baseLen = events.length > 0 ? takeLength : barDur * 2;

      if (includeSeq && state.tracks.length) {
        var stepDur = (60 / state.bpm) / 4;
        var totalSteps = Math.max(16, Math.round(baseLen / stepDur));
        for (var stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
          var s = stepIdx % 16;
          var swingOffset = (s % 2 === 1) ? (state.swing / 100) * stepDur * 0.62 : 0;
          var tAt = stepIdx * stepDur + swingOffset;
          if (tAt >= baseLen) break;
          state.tracks.forEach(function (trk) {
            if (trk.steps[s] > 0) {
              var ev = trackToEvent(trk, trk.steps[s]);
              ev.time = tAt;
              events.push(ev);
            }
          });
        }
      }

      if (!events.length) {
        exporting = false;
        recordingUI();
        notify('Nothing to export yet.');
        return;
      }

      var end = events.reduce(function (max, event) {
        var buf = bufferFor(event.bank, event.index);
        var dur = buf ? buf.duration / Math.pow(2, ((event.pitch || 0) + (event.tune || 0)) / 12) : 0.5;
        return Math.max(max, event.time + dur);
      }, baseLen);

      var tail = state.delay > 0 ? 1.8 : 1.0;
      var offline = new Offline(2, Math.ceil((end + tail) * 44100), 44100);
      var offChain = outputChain(offline, state.bpm, state.filter);
      events.forEach(function (event) {
        scheduleEvent(offline, offChain, event, event.time, false);
      });

      notify('Rendering stereo WAV…');
      return offline.startRendering().then(function (rendered) {
        var wav = synth.encodeWav([rendered.getChannelData(0), rendered.getChannelData(1)], 44100);
        var url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = 'soundboard-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.wav';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        notify('WAV saved. On iPad, use Share → Save to Files.');
      });
    }).catch(function () {
      notify('Export failed. Try a shorter take.');
    }).then(function () {
      exporting = false;
      recordingUI();
    });
  });

  $('demo').addEventListener('click', function () {
    editMode(false);
    $('sequencer').hidden = false;
    $('seq-toggle').setAttribute('aria-expanded', 'true');
    var idx = grooveOrder.indexOf(state.groove);
    var nextKey = seqPlaying ? grooveOrder[(idx + 1) % grooveOrder.length] : (idx >= 0 ? grooveOrder[idx] : 'lagos');
    applyGroovePreset(nextKey, true);
    notify('Playing groove: ' + model.grooves[nextKey].name + ' (' + state.bpm + ' BPM)');
  });

  $('help-button').addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    $('help').hidden = open;
    this.querySelector('span').textContent = open ? '+' : '−';
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAll();
      audioSession.pause();
    }
  });
  window.addEventListener('pagehide', function () {
    stopAll();
    audioSession.pause();
  });

  /* Initial Render */
  syncMixerVisuals();
  renderPads();
  (function initScopeCanvas() {
    var c = $('scope');
    if (c && c.getContext) drawIdleScope(c.getContext('2d'), c.width, c.height);
  })();

  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data === 'OFFLINE_READY') offlineReady();
    });
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(function (registration) {
      if (registration.active) registration.active.postMessage('CHECK_OFFLINE');
    }).catch(function () {
      $('offline-status').textContent = 'ONLINE ONLY';
    });
  } else {
    $('offline-status').textContent = 'ONLINE ONLY';
  }

  function offlineReady() {
    $('offline-status').innerHTML = '<span class="tiny-dot"></span> OFFLINE READY';
    $('offline-status').classList.add('ready');
  }
})();
