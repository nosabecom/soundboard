import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('page IDs are unique and all application element references exist', () => {
  const html=fs.readFileSync('public/index.html','utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,new Set(ids).size);
  const app=fs.readFileSync('public/app.js','utf8');
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]),match[1]);
});
test('all files in the offline shell exist and are inside the app scope', () => {
  const sw=fs.readFileSync('public/sw.js','utf8');
  for (const match of sw.matchAll(/'\.\/([^']+)'/g)) assert.ok(fs.existsSync('public/'+match[1]),match[1]);
  assert.ok(sw.includes("url.pathname.indexOf(scope.pathname) !== 0"));
});
