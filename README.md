# Soundboard (SB—02)

A tactile, touch-first pocket groovebox and sound lab for iPad, desktop, and mobile, inspired by physical percussion samplers and step sequencers.

**Play:** https://nosa.dev/soundboard/

- **Nine instrument banks:** drum kit (with authentic open/closed hi-hat choke), 808 & bass, synthesized grand piano, electric piano, drawbar organ, analog synth, lush pad, kalimba, and 16 Earshot SFX.
- **Smart scales & chord voicings:** chromatic, major, natural minor, minor pentatonic, Dorian, Mixolydian, blues, and Hirajoshi scales—plus instant diatonic chord modes (`Single`, `Power 5th`, `Triads`, `7th Lush`, `9th Jazz`) with humanized strumming.
- **16-step groove sequencer:** six built-in multi-instrument grooves (*Lagos Bounce*, *90s Boom Bap*, *UK 2-Step*, *Midnight Lo-Fi*, *808 Studio*, *Neon Drive*), custom per-pad step programming with Shift-click accents, tempo (`60–180 BPM`), tap tempo, swing, and metronome click.
- **Expressive performance:** 2×2 to 8×8 pad grids, finger-glide strumming, multi-touch and keyboard playback (`1234 / QWER / ASDF / ZXCV`), and tempo-locked hold-to-roll note repeat (`1/8`, `1/16`, `1/24T`, `1/32`, or hold `Shift`).
- **Multi-layer overdub looper & WAV export:** record up to 30 seconds, overdub additional instrument passes with `1/16` input quantize and per-layer undo, and export a stereo 44.1 kHz PCM WAV (including active sequencer bars, filter, stereo dub echo, and room reverb tails).
- **Live FX, OLED scope & zero-backend sharing:** interactive rotary dials + sliders for volume, pitch, DJ bi-directional filter (`LPF ↔ HPF`), stereo tempo-synced dub echo, and room reverb; real-time waveform/spectrum OLED display; per-pad semitone tune and level trim; and compact `#s=...` URL state sharing.
- **Offline PWA:** scoped strictly to `/soundboard/`. On iPad: Safari → Share → Add to Home Screen. Wait for **OFFLINE READY** before going offline.

All instrument voices are deterministic client-side synthesis (plus committed Earshot WAVs) requiring no server, microphone, or API key. On iPad, the app activates the `playback` audio session (with a silent media-channel fallback on older WebKit) so Silent Mode does not mute playback.

## Development

Node 24+ and the pinned pnpm version in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build
pnpm preview
```

Development serves `http://localhost:5173/soundboard/`. The dependency-free build writes static files to `dist/soundboard/`. Offline caching is disabled on localhost so file changes show immediately.

## Hosting

The repository is `nosabecom/soundboard`, connected to the `soundboard` Vercel project. Vercel builds with `pnpm build`, and the `portfolio` project proxies `/soundboard` and its descendants to the soundboard production domain.

Routing details are in [docs/deployment.md](docs/deployment.md). Bump the cache version in `public/sw.js` and keep the `?v=` markers in HTML, worker imports, and its precache list in sync when shipping asset changes.
