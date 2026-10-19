(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, synth = window.SoundboardSynth, model = window.SoundboardLayout;
  var stored; try { stored = JSON.parse(localStorage.getItem('nosa-soundboard-v2') || '{}'); } catch (_) {}
  var audioSession = window.SoundboardAudioSession.create(navigator, document);
  var state = model.normalize(stored), context = null, bus = null, reverb = null, impulse = null, buffers = {}, sources = new Set(), loadPromise = null;
  var keys = Array.from(new Set('1234qwerasdfzxcv567890tyuiopghjklbnm-=[];,.'.split('')));
  var colors = { drums:'#edb695', piano:'#acc3ed', electric:'#c4ace8', organ:'#98cecc', synth:'#eca995', keys:'#c6d29f', earshot:'#d9a2bb' };
  var effects = ['Deep impact', 'Glass ping', 'Fast whoosh', 'Sub drop', 'Bubble pop', 'Soft click', 'Glitch', 'Shimmer', 'Space zip', 'Low knock', 'Riser', 'Swipe', 'Kalimba', 'Key thock', 'Logo sting', 'Air fall'];
  var take = [], recording = false, recordStart = 0, takeLength = 0, recordFrame = null, looping = false, loopTimer = null, nextLoop = 0, visualTimers = new Set(), hitTimers = {}, exporting = false, editing = false, editorIndex = null, focusBeforeEditor = null, audioStarting = null;
  function save() { try { localStorage.setItem('nosa-soundboard-v2', JSON.stringify(state)); } catch (_) { notify('Device storage is full. This layout will last for this session.'); } }
  var voiceWorker=null, warmed={}, pendingVoices=new Set();
  try { voiceWorker=new Worker('./voice-worker.js?v=7'); voiceWorker.onmessage=function(event){var voice=event.data,key=voice.bank+':'+voice.index;pendingVoices.delete(key);warmed[key]=voice; if(context) bufferFor(voice.bank,voice.index);}; voiceWorker.onerror=function(){voiceWorker.terminate();voiceWorker=null;pendingVoices.clear();}; } catch(_) {}
  function warmBoard(){if(!voiceWorker)return;state.boards[state.mode].slice(0,state.size*state.size).forEach(function(pad){var key=pad.bank+':'+pad.index;if(pad.bank==='earshot'||warmed[key]||(buffers[pad.bank]&&buffers[pad.bank][pad.index])||pendingVoices.has(key))return;pendingVoices.add(key);voiceWorker.postMessage({bank:pad.bank,index:pad.index});});}
  var noticeTimer;
  function notify(message) { $('notice').textContent = message; clearTimeout(noticeTimer); if (message) noticeTimer = setTimeout(function () { $('notice').textContent = ''; }, 6500); }
  function soundName(which, index) { return which === 'drums' ? synth.drumNames[index] : which === 'earshot' ? effects[index] : model.noteName(index); }
  function waveform(index) { var lines = ''; for (var i = 0; i < 22; i++) { var height = 2 + Math.abs(Math.sin(i * (index + 3) * .71)) * 19 * Math.exp(-i * .09); lines += '<path d="M' + (i * 2.8 + 1) + ' ' + (13 - height / 2) + 'v' + height + '"/>'; } return '<svg viewBox="0 0 64 26" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + lines + '</svg>'; }
  function renderPads() {
    var pads = state.boards[state.mode].slice(0, state.size * state.size);
    $('pads').style.setProperty('--grid-size', state.size); $('pads').dataset.size = state.size;
    $('pads').innerHTML = pads.map(function (assignment, i) {
      var name = soundName(assignment.bank, assignment.index), key = keys[i];
      return '<button class="pad" style="--color:' + colors[assignment.bank] + '" data-pad="' + i + '" aria-label="Pad ' + (i + 1) + ', ' + model.names[assignment.bank] + ', ' + name + (key ? ', key ' + key.toUpperCase() : '') + '"><span class="pad-top"><span>' + String(i + 1).padStart(2,'0') + '</span>' + (key ? '<kbd>' + key.toUpperCase() + '</kbd>' : '') + '</span><span class="pad-name">' + name + '</span>' + (assignment.bank !== state.mode ? '<span class="pad-instrument">' + model.names[assignment.bank] + '</span>' : '') + waveform(assignment.index) + '</button>';
    }).join('');
    $('bank-meta').textContent = pads.length + ' PADS · ' + model.names[state.mode].toUpperCase();
    $('mode').value = state.mode; $('grid-size').value = state.size;
    var config = state.settings[state.mode]; $('root-note').value = config.root; $('scale').value = config.scale; $('octave').value = config.octave;
    ['root-note','scale','octave'].forEach(function (id) { $(id).disabled = !model.melodic(state.mode); });
    warmBoard();
  }
  function setMode(mode) { state.mode = mode; renderPads(); save(); }
  function createImpulse(ctx) { var buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * .85), ctx.sampleRate), rng = 123; for (var c = 0; c < 2; c++) { var data = buffer.getChannelData(c); for (var i = 0; i < data.length; i++) { rng = (Math.imul(rng,1664525)+1013904223)|0; data[i] = ((rng>>>0)/4294967296*2-1) * Math.pow(1-i/data.length,3); } } return buffer; }
  function outputChain(ctx) { var master = ctx.createGain(), limiter = ctx.createDynamicsCompressor(), room = ctx.createConvolver(); master.gain.value = .72; limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = .002; limiter.release.value = .12; master.connect(limiter); limiter.connect(ctx.destination); room.buffer = impulse || createImpulse(ctx); room.connect(master); return { bus: master, room: room }; }
  function unlock() {
    audioSession.activate();
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return Promise.reject(new Error('Web Audio unavailable'));
    if (!context) { context = new Audio({latencyHint:'interactive'}); impulse = createImpulse(context); var chain = outputChain(context); bus = chain.bus; reverb = chain.room; context.onstatechange = function () { var active = context.state === 'running'; $('power').classList.toggle('on',active); $('power-label').textContent = active ? 'Test audio' : 'Resume audio'; }; }
    var resume = context.resume();
    var silent = context.createBufferSource(); silent.buffer = context.createBuffer(1,1,22050); silent.connect(context.destination); silent.start(0);
    return Promise.resolve(resume);
  }
  function loadEffects() {
    if (buffers.earshot) return Promise.resolve();
    if (loadPromise) return loadPromise;
    notify('Loading Earshot…');
    loadPromise = Promise.all(effects.map(function (_, i) { return fetch('./audio/' + String(i+1).padStart(2,'0') + '.wav').then(function (response) { if (!response.ok) throw new Error('Sound download failed'); return response.arrayBuffer(); }).then(function (bytes) { return new Promise(function (resolve,reject) { context.decodeAudioData(bytes,resolve,reject); }); }); })).then(function (sounds) { buffers.earshot = sounds; notify('Earshot ready'); }).catch(function (error) { loadPromise = null; throw error; });
    return loadPromise;
  }
  function bufferFor(which, index) {
    if (!buffers[which]) buffers[which] = [];
    if (!buffers[which][index] && which !== 'earshot') { var voice = warmed[which+':'+index] || synth.voice(which,index,44100), buffer = context.createBuffer(1,voice.data.length,voice.sampleRate); buffer.getChannelData(0).set(voice.data); buffers[which][index] = buffer; delete warmed[which+':'+index]; }
    return buffers[which][index];
  }
  function prepare(which, index) { return which === 'earshot' ? loadEffects() : Promise.resolve(bufferFor(which,index)); }
  function flash(slot, which, delay) {
    if (delay > 2) { var timer = setTimeout(function () { visualTimers.delete(timer); flash(slot,which,0); },delay); visualTimers.add(timer); return; }
    if (which !== state.mode) return;
    var pad = $('pads').children[slot]; if (!pad) return;
    pad.classList.add('hit'); clearTimeout(hitTimers[slot]); hitTimers[slot] = setTimeout(function () { pad.classList.remove('hit'); },115);
  }
  function connectSource(ctx, event, when, output, room) {
    var buffer = bufferFor(event.bank,event.index); if (!buffer) return null;
    var source = ctx.createBufferSource(), gain = ctx.createGain(), send = ctx.createGain(); source.buffer = buffer; source.playbackRate.value = Math.pow(2,event.pitch/12); gain.gain.value = event.volume; send.gain.value = event.room; source.connect(gain); gain.connect(output); gain.connect(send); send.connect(room); source.start(when);
    source.onended = function () { sources.delete(source); source.disconnect(); gain.disconnect(); send.disconnect(); };
    return source;
  }
  function play(event, when) {
    if (sources.size >= 48) { var oldest = sources.values().next().value; try { oldest.stop(); } catch (_) {} sources.delete(oldest); }
    var at = when || context.currentTime, source = connectSource(context,event,at,bus,reverb); if (!source) return;
    sources.add(source); flash(event.slot,event.board,Math.max(0,(at-context.currentTime)*1000));
  }
  function eventFor(assignment, slot) { return { bank:assignment.bank, index:assignment.index, board:state.mode, slot:slot, pitch:state.pitch, volume:state.volume, room:state.room, time:recording ? context.currentTime-recordStart : 0 }; }
  function hit(slot) {
    if (editing) { openEditor(slot); return; }
    var assignment = state.boards[state.mode][slot]; if (!assignment) return;
    if (!context || context.state !== 'running') { if (audioStarting) return; audioStarting = unlock().then(function () { audioStarting = null; hit(slot); }).catch(function () { audioStarting = null; notify('Tap Enable audio to retry.'); }); return; }
    if (assignment.bank === 'earshot' && !buffers.earshot) { prepare('earshot').then(function () { hit(slot); }).catch(function () { notify('Earshot could not load. Check your connection and tap again.'); }); return; }
    var event = eventFor(assignment,slot); play(event); $('now-playing').textContent = String(slot+1).padStart(2,'0') + ' / ' + soundName(assignment.bank,assignment.index); if (recording) take.push(event);
  }
  function formatTime(time) { return String(Math.floor(time/60)).padStart(2,'0') + ':' + (time%60).toFixed(1).padStart(4,'0'); }
  function recordingUI() { $('record').classList.toggle('active',recording); $('record-label').textContent = recording ? 'Finish' : 'Record'; $('record').setAttribute('aria-label',recording ? 'Finish recording' : 'Start recording'); $('take-state').textContent = recording ? 'REC · 30s MAX' : take.length ? take.length + ' HITS' : 'READY'; $('download').disabled = !take.length || recording || exporting; $('loop').disabled = !take.length || recording; }
  function tick() { if (!recording) return; var elapsed = context.currentTime-recordStart; $('timer').textContent = formatTime(elapsed); if (elapsed>=30) { finishRecording(); return; } recordFrame = requestAnimationFrame(tick); }
  function finishRecording() { if (!recording) return; recording = false; takeLength = Math.max(.25,Math.min(30,context.currentTime-recordStart)); cancelAnimationFrame(recordFrame); $('timer').textContent = formatTime(takeLength); recordingUI(); if (!take.length) notify('No hits recorded.'); }
  function stopAll() { looping = false; clearTimeout(loopTimer); $('loop').setAttribute('aria-pressed','false'); visualTimers.forEach(clearTimeout); visualTimers.clear(); sources.forEach(function (source) { try { source.stop(); } catch (_) {} }); sources.clear(); if (recording) finishRecording(); Array.prototype.forEach.call($('pads').children,function (pad) { pad.classList.remove('hit'); }); }
  function scheduleLoop() { if (!looping) return; var now = context.currentTime; if (nextLoop < now-.1) nextLoop = now+.04; while (nextLoop < now+.12) { take.forEach(function (event) { play(event,nextLoop+event.time); }); nextLoop += takeLength; } loopTimer = setTimeout(scheduleLoop,40); }
  function editMode(enabled) { editing = enabled; $('edit-pads').setAttribute('aria-pressed',String(enabled)); $('pads').classList.toggle('editing',enabled); $('edit-hint').hidden = !enabled; }
  function editorOptions(selected) { var which = $('pad-instrument').value, count = model.melodic(which) ? 96 : 16; $('pad-sound').innerHTML = Array.from({length:count},function (_,i) { return '<option value="'+i+'">'+soundName(which,i)+'</option>'; }).join(''); $('pad-sound').value = selected === undefined ? (model.melodic(which) ? 24 : 0) : selected; }
  function openEditor(slot) { editorIndex = slot; focusBeforeEditor = document.activeElement; var pad = state.boards[state.mode][slot]; $('editor-title').textContent = 'Pad '+String(slot+1).padStart(2,'0'); $('pad-instrument').value = pad.bank; editorOptions(pad.index); $('pad-editor').hidden = false; $('pad-instrument').focus(); }
  function closeEditor() { $('pad-editor').hidden = true; editorIndex = null; if (focusBeforeEditor && document.contains(focusBeforeEditor)) focusBeforeEditor.focus(); else $('edit-pads').focus(); }
  $('pads').addEventListener(window.PointerEvent?'pointerdown':'touchstart',function (event) { var pad = event.target.closest('[data-pad]'); if (!pad || (event.pointerType==='mouse' && event.button!==0)) return; event.preventDefault(); hit(Number(pad.dataset.pad)); },{passive:false});
  if (!window.PointerEvent) $('pads').addEventListener('mousedown',function (event) { if (event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents) return; var pad = event.target.closest('[data-pad]'); if (pad && event.button===0) { event.preventDefault(); hit(Number(pad.dataset.pad)); } });
  $('pads').addEventListener('click',function (event) { if (event.detail!==0) return; var pad = event.target.closest('[data-pad]'); if (pad) hit(Number(pad.dataset.pad)); });
  document.addEventListener('keydown',function (event) {
    if (!$('pad-editor').hidden) { if (event.key==='Escape') { event.preventDefault(); closeEditor(); } if (event.key==='Tab') { var focusable=$('pad-editor').querySelectorAll('button,select'), first=focusable[0],last=focusable[focusable.length-1]; if (event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); } } return; }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    var slot = keys.indexOf(event.key.toLowerCase()); if (slot>=0 && slot<state.size*state.size) { event.preventDefault(); hit(slot); } if (event.key==='Escape') stopAll();
  });
  $('power').addEventListener('click',function () { unlock().then(function () {
    if (state.volume === 0) { notify('Volume is at 0%. Raise the soundboard volume to hear it.'); return; }
    // An audible confirmation tests the output, rather than just context.state.
    play({bank:'keys',index:36,board:state.mode,slot:-1,pitch:0,volume:Math.min(state.volume,.5),room:0});
    if (state.mode==='earshot') return loadEffects();
  }).catch(function () { notify('Audio could not start. Tap to retry.'); }); });
  $('mode').addEventListener('change',function () { setMode(this.value); });
  $('previous-mode').addEventListener('click',function () { setMode(model.modes[(model.modes.indexOf(state.mode)+model.modes.length-1)%model.modes.length]); });
  $('next-mode').addEventListener('click',function () { setMode(model.modes[(model.modes.indexOf(state.mode)+1)%model.modes.length]); });
  $('grid-size').addEventListener('change',function () { state.size=Number(this.value); renderPads(); save(); });
  $('edit-pads').addEventListener('click',function () { editMode(!editing); }); $('done-edit').addEventListener('click',function () { editMode(false); });
  $('settings-button').addEventListener('click',function () { var open=this.getAttribute('aria-expanded')==='true'; this.setAttribute('aria-expanded',String(!open)); $('settings').hidden=open; });
  ['root-note','scale','octave'].forEach(function (id) { $(id).addEventListener('change',function () { var config=state.settings[state.mode]; config.root=Number($('root-note').value); config.scale=$('scale').value; config.octave=Number($('octave').value); state.boards[state.mode]=state.boards[state.mode].map(function (pad,i) { return pad.bank===state.mode ? model.defaultPad(state.mode,i,config) : pad; }); renderPads(); save(); }); });
  $('reset-board').addEventListener('click',function () { state.boards[state.mode]=Array.from({length:64},function (_,i) { return model.defaultPad(state.mode,i,state.settings[state.mode]); }); renderPads(); save(); notify('Mode layout reset.'); });
  $('pad-instrument').addEventListener('change',function () { editorOptions(); }); $('editor-close').addEventListener('click',closeEditor);
  $('pad-editor').addEventListener('click',function (event) { if (event.target===this) closeEditor(); });
  $('preview-pad').addEventListener('click',function () { var assignment={bank:$('pad-instrument').value,index:Number($('pad-sound').value)}; unlock().then(function () { return prepare(assignment.bank,assignment.index); }).then(function () { play(eventFor(assignment,-1)); }).catch(function () { notify('Could not load this sound. Check your connection.'); }); });
  $('save-pad').addEventListener('click',function () { if (editorIndex===null) return; var slot=editorIndex; state.boards[state.mode][slot]={bank:$('pad-instrument').value,index:Number($('pad-sound').value)}; closeEditor(); renderPads(); save(); $('pads').children[slot].focus(); });
  $('volume').addEventListener('input',function () { state.volume=Number(this.value)/100; $('volume-value').textContent=this.value+'%'; $('volume-knob').style.setProperty('--rotation',(state.volume*270-135)+'deg'); save(); });
  $('pitch').addEventListener('input',function () { state.pitch=Number(this.value); $('pitch-value').textContent=(state.pitch>0?'+':'')+state.pitch+' st'; $('pitch-knob').style.setProperty('--rotation',(state.pitch/12*135)+'deg'); save(); });
  $('room').addEventListener('input',function () { state.room=Number(this.value)/100; $('room-value').textContent=this.value+'%'; save(); });
  $('record').addEventListener('click',function () { if (recording) { finishRecording(); return; } $('record').disabled=true; $('record-label').textContent='Loading'; unlock().then(function () {
    // Decode any mapped effects before starting the clock.
    var needsEffects=state.boards[state.mode].slice(0,state.size*state.size).some(function (pad) { return pad.bank==='earshot'; }); return needsEffects?loadEffects():Promise.resolve();
  }).then(function () { stopAll(); editMode(false); take=[]; takeLength=0; recording=true; recordStart=context.currentTime; $('record').disabled=false; recordingUI(); tick(); }).catch(function () { $('record').disabled=false; recordingUI(); notify('Could not start recording. Enable audio and retry.'); }); });
  $('stop').addEventListener('click',stopAll);
  $('loop').addEventListener('click',function () { if (looping) { stopAll(); return; } unlock().then(function () { stopAll(); looping=true; nextLoop=context.currentTime+.04; $('loop').setAttribute('aria-pressed','true'); scheduleLoop(); }).catch(function () { notify('Enable audio to play your take.'); }); });
  $('download').addEventListener('click',function () {
    if (!take.length || exporting) return; var Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext; if (!Offline) { notify('WAV export is unavailable in this browser.'); return; }
    exporting=true; recordingUI(); var events=take.slice(), end=events.reduce(function (max,event) { return Math.max(max,event.time+bufferFor(event.bank,event.index).duration/Math.pow(2,event.pitch/12)); },takeLength);
    var offline=new Offline(2,Math.ceil((end+.9)*44100),44100), chain=outputChain(offline); events.forEach(function (event) { connectSource(offline,event,event.time,chain.bus,chain.room); });
    notify('Rendering WAV…'); offline.startRendering().then(function (rendered) { var wav=synth.encodeWav([rendered.getChannelData(0),rendered.getChannelData(1)],44100), url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'})), link=document.createElement('a'); link.href=url; link.download='soundboard-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.wav'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); },60000); notify('WAV saved. On iPad, use Share → Save to Files.'); }).catch(function () { notify('Export failed. Try a shorter take.'); }).then(function () { exporting=false; recordingUI(); });
  });
  $('demo').addEventListener('click',function () { unlock().then(function () { stopAll(); editMode(false); setMode('drums'); var pattern=[[0,0],[0,2],[1,2],[2,1],[2,2],[3,2],[3.5,2],[4,0],[4,2],[5,2],[6,1],[6,2],[7,3],[7.5,8],[8,0],[8,2],[9,2],[10,1],[10,2],[11,2],[11.5,2],[12,0],[12,2],[13,2],[14,1],[14,2],[15,3]],start=context.currentTime+.05; pattern.forEach(function (item) { play({bank:'drums',index:item[1],board:'drums',slot:item[1],pitch:state.pitch,volume:state.volume*(item[1]===2?.65:1),room:state.room},start+item[0]*.25); }); }).catch(function () { notify('Enable audio to try the beat.'); }); });
  $('help-button').addEventListener('click',function () { var open=this.getAttribute('aria-expanded')==='true'; this.setAttribute('aria-expanded',String(!open)); $('help').hidden=open; this.querySelector('span').textContent=open?'+':'−'; });
  document.addEventListener('visibilitychange',function () { if (document.hidden) { stopAll(); audioSession.pause(); } }); window.addEventListener('pagehide',function () { stopAll(); audioSession.pause(); });
  $('volume-knob').style.setProperty('--rotation',(state.volume*270-135)+'deg'); $('pitch-knob').style.setProperty('--rotation',(state.pitch/12*135)+'deg'); $('volume').value=state.volume*100; $('volume-value').textContent=Math.round(state.volume*100)+'%'; $('pitch').value=state.pitch; $('pitch-value').textContent=(state.pitch>0?'+':'')+state.pitch+' st'; $('room').value=state.room*100; $('room-value').textContent=Math.round(state.room*100)+'%'; renderPads(); recordingUI();
  if ('serviceWorker' in navigator && location.hostname!=='localhost' && location.hostname!=='127.0.0.1') { navigator.serviceWorker.addEventListener('message',function (event) { if (event.data==='OFFLINE_READY') offlineReady(); }); navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(function (registration) { if (registration.active) registration.active.postMessage('CHECK_OFFLINE'); }).catch(function () { $('offline-status').textContent='ONLINE ONLY'; }); } else $('offline-status').textContent='ONLINE ONLY';
  function offlineReady() { $('offline-status').innerHTML='<span class="tiny-dot"></span> OFFLINE READY'; $('offline-status').classList.add('ready'); }
})();
