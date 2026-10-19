import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function worker(fetch) {
  const handlers={},cached={body:'offline shell'},matches=[];
  const env={URL,Promise,fetch,caches:{match:async key=>{matches.push(key);return cached;}},self:{registration:{scope:'https://nosa.dev/soundboard/'},addEventListener:(type,fn)=>handlers[type]=fn}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),env);
  return {handlers,cached,matches};
}
function request(worker,url,mode='navigate') {
  let promise;
  worker.handlers.fetch({request:{url,mode,method:'GET'},respondWith:p=>{promise=p;}});
  return promise;
}
test('online navigation loads fresh HTML instead of trapping clients in an older cached app',async()=>{
  const fresh={ok:true,body:'new HTML'},w=worker(async()=>fresh);
  assert.equal(await request(w,'https://nosa.dev/soundboard/?v=7'),fresh);
  assert.equal(w.matches.length,0);
});
test('update links still open the saved app while offline',async()=>{
  const w=worker(async()=>{throw new Error('offline');});
  assert.equal(await request(w,'https://nosa.dev/soundboard/?v=7'),w.cached);
  assert.equal(w.matches[0],'https://nosa.dev/soundboard/');
});
test('navigation to another site path is never intercepted',()=>{
  const w=worker(async()=>{throw new Error('must not fetch');});
  assert.equal(request(w,'https://nosa.dev/'),undefined);
  assert.equal(request(w,'https://example.com/soundboard/'),undefined);
});
test('versioned application and worker URLs are all included in the offline shell',()=>{
  const html=fs.readFileSync('public/index.html','utf8'),sw=fs.readFileSync('public/sw.js','utf8');
  for(const match of html.matchAll(/(?:src|href)="(\.\/[^"?]+\?v=\d+)"/g)) assert.ok(sw.includes("'"+match[1]+"'"),match[1]);
  for(const file of ['public/app.js','public/voice-worker.js']) for(const match of fs.readFileSync(file,'utf8').matchAll(/'(\.\/[^'?]+\?v=\d+)'/g)) assert.ok(sw.includes("'"+match[1]+"'"),match[1]);
});
