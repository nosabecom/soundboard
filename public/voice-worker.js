/* Pre-render notes off the UI thread; taps stay responsive while presets warm up. */
importScripts('./synth.js?v=7');
self.onmessage=function(event){
  var job=event.data, voice=self.SoundboardSynth.voice(job.bank,job.index,44100);
  self.postMessage({bank:job.bank,index:job.index,sampleRate:voice.sampleRate,data:voice.data},[voice.data.buffer]);
};
