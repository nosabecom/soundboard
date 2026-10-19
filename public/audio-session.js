/* iOS Web Audio defaults to the ambient channel, which obeys Silent Mode.
   Prefer the playback session; older WebKit needs an unmuted media element.
   https://bugs.webkit.org/show_bug.cgi?id=237322 */
(function (root) {
  'use strict';
  function create(navigator, document) {
    var media = null;
    var ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return {
      activate: function () {
        try {
          if (navigator.audioSession) {
            navigator.audioSession.type = 'playback';
            if (navigator.audioSession.type === 'playback') return;
          }
        } catch (_) { /* Some iOS browser versions expose a restricted setter. */ }
        if (!ios) return;
        if (!media) {
          media = document.createElement('audio');
          media.src = './audio/session.wav';
          media.loop = true;
          media.preload = 'auto';
          media.muted = false;
          media.volume = 1;
          media.setAttribute('playsinline', '');
          media.setAttribute('webkit-playsinline', '');
          media.setAttribute('aria-hidden', 'true');
          media.hidden = true;
          document.body.appendChild(media);
        }
        // Must run directly inside the user's gesture, before awaiting resume().
        try { var playing = media.play(); if (playing && playing.catch) playing.catch(function () {}); } catch (_) {}
      },
      pause: function () { if (media) media.pause(); }
    };
  }
  root.SoundboardAudioSession = { create: create };
})(typeof window === 'undefined' ? globalThis : window);
