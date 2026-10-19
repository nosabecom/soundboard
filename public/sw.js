/* This service worker owns only /soundboard/ and its own cache. */
var CACHE = 'nosa-soundboard-v5';
var FILES = ['./', './index.html', './style.css', './synth.js', './layout.js', './voice-worker.js', './app.js', './icon.svg', './apple-touch-icon.png', './manifest.webmanifest'];
for (var i = 1; i <= 16; i++) FILES.push('./audio/' + String(i).padStart(2, '0') + '.wav');
self.addEventListener('install', function (event) { event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (event) { event.waitUntil(caches.keys().then(function (names) { return Promise.all(names.filter(function (name) { return name.indexOf('nosa-soundboard-') === 0 && name !== CACHE; }).map(function (name) { return caches.delete(name); })); }).then(function () { return self.clients.claim(); }).then(function () { return self.clients.matchAll(); }).then(function (clients) { clients.forEach(function (client) { client.postMessage('OFFLINE_READY'); }); })); });
self.addEventListener('message', function (event) { if (event.data === 'CHECK_OFFLINE') caches.open(CACHE).then(function (cache) { return cache.keys(); }).then(function (keys) { if (keys.length >= FILES.length && event.source) event.source.postMessage('OFFLINE_READY'); }); });
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || url.pathname.indexOf(scope.pathname) !== 0) return;
  event.respondWith(caches.match(event.request).then(function (cached) { return cached || fetch(event.request); }));
});
