# Soundboard

A touch-first, dark soundboard for iPad and desktop, inspired by physical percussion pads.

**Play:** https://nosa.dev/soundboard/

- Seven instrument modes: drum kit, synthesized grand piano, electric piano, organ, analog synth, kalimba, and 16 Earshot effects.
- 2×2, 3×3, 4×4, 6×6, and 8×8 grids. Cycle presets with the arrow buttons.
- Edit any pad to mix a sound or note from another instrument into the current mode. Each mode keeps its own layout.
- Root note, chromatic/major/minor/pentatonic scales, start octave, pitch, room reverb, and volume.
- Multi-touch and keyboard playback. The first 16 pad shortcuts are `1234 / QWER / ASDF / ZXCV`; larger grids show additional shortcuts on the pads.
- Record up to 30 seconds, loop your performance, and export a stereo PCM WAV including sound tails and reverb.
- Device-local layout/settings persistence. Recordings are held in memory until downloaded; reloading clears the take.
- Offline PWA, scoped to `/soundboard/`. On iPad: Safari → Share → Add to Home Screen. Wait for **OFFLINE READY** before going offline.

Tap **Enable audio** once. Play a pad directly to enable audio automatically. Open **Edit pads**, select a pad, choose an instrument and sound, and save. **Settings** changes the note layout in the active instrument; mixed-in instruments remain assigned. **Reset this mode** restores the current preset's layout.

All instrument voices are one-shot synthesized sounds, including the piano approximations. They do not require a server, microphone, or API key. The Earshot WAVs are committed assets; provenance and regeneration instructions are in [docs/sounds.md](docs/sounds.md). Synthesized voices are warmed in a worker so interaction stays responsive. iPad layouts are checked in responsive browser emulation; Safari/device audio behavior still depends on the device volume and audio policies.

## Development

Node 22+ and the pinned pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build
pnpm preview
```

Development serves `http://localhost:5173/soundboard/`. The dependency-free build writes static files to `dist/soundboard/`. Offline caching is disabled on localhost so file changes show immediately.

## Hosting

The private repository is `nosabecom/soundboard`, connected to the separate Vercel `soundboard` project. Vercel builds with `pnpm build`. The portfolio project's routing rule proxies `/soundboard` and its descendants to the soundboard project's stable production domain, preserving the path. This keeps the source private while the playable website is public and leaves portfolio source untouched.

Routing details are in [docs/deployment.md](docs/deployment.md). Bump the app cache version in `public/sw.js` whenever shipping asset changes. The service worker only handles `/soundboard/` and only deletes caches prefixed `nosa-soundboard-`.
