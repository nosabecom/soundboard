import test from 'node:test';
import assert from 'node:assert/strict';
await import('../public/audio-session.js');
const {create}=globalThis.SoundboardAudioSession;
function device(extra={}) {
  const elements=[], calls=[];
  const document={body:{appendChild:el=>elements.push(el)},createElement(tag){assert.equal(tag,'audio');return {setAttribute(){},play(){calls.push('play');return Promise.resolve();},pause(){calls.push('pause');}};}};
  return {navigator:{userAgent:'Mozilla/5.0 (iPad)',platform:'iPad',maxTouchPoints:5,...extra},document,elements,calls};
}
test('iPad uses playback instead of ambient even while the audio context is already running',()=>{
  const env=device({audioSession:{type:'ambient'}});
  const session=create(env.navigator,env.document);
  session.activate();
  assert.equal(env.navigator.audioSession.type,'playback');
  assert.equal(env.elements.length,0,'native session must not create a looping media element');
  // iOS can reset the category following another app or an interruption.
  env.navigator.audioSession.type='ambient';
  session.activate();
  assert.equal(env.navigator.audioSession.type,'playback');
});
test('older iPad opens the media channel synchronously and reuses one unmuted element',()=>{
  const env=device(),session=create(env.navigator,env.document);
  session.activate();
  assert.deepEqual(env.calls,['play']);
  assert.equal(env.elements[0].muted,false);
  assert.equal(env.elements[0].loop,true);
  assert.equal(env.elements[0].src,'./audio/session.wav');
  session.activate();
  assert.equal(env.elements.length,1);
  session.pause();
  assert.deepEqual(env.calls,['play','play','pause']);
});
test('desktop-style iPad user agents still get the legacy fallback',()=>{
  const env=device({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel'});
  create(env.navigator,env.document).activate();
  assert.equal(env.elements.length,1);
});
test('a restricted audioSession setter falls back instead of breaking pad playback',()=>{
  const env=device({audioSession:{get type(){return 'ambient';},set type(_){throw new Error('NotSupportedError');}}});
  assert.doesNotThrow(()=>create(env.navigator,env.document).activate());
  assert.equal(env.elements.length,1);
});
test('ordinary desktop browsers do not get an unnecessary background audio element',()=>{
  const env=device({userAgent:'Mozilla/5.0 (X11; Linux x86_64)',platform:'Linux x86_64',maxTouchPoints:0});
  const session=create(env.navigator,env.document);
  session.activate();session.pause();
  assert.deepEqual(env.calls,[]);
});
test('rejected media playback is handled without an unhandled rejection',async()=>{
  const env=device();
  env.document.createElement=()=>({setAttribute(){},play(){return Promise.reject(new Error('NotAllowedError'));},pause(){}});
  create(env.navigator,env.document).activate();
  await new Promise(resolve=>setTimeout(resolve,0));
});
