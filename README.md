# Roastbook

A fully on-device, glasses-driven life-commentary app built on the Mentra Bluetooth SDK and
[Cactus](https://cactuscompute.com) for local LLM / STT / VAD / vision. Nothing leaves the phone:
no cloud LLM, no cloud STT, no cloud anything.

Two modes:

- **Hyde** — a snarky, terminally-online friend who roasts you and the people around you based on
  what the glasses hear and see.
- **Jekyll** — the same friend, in a good mood. Specific, observational compliments grounded in
  what's actually in the room.

Both modes use the same engine: rolling transcript + the latest photo + speaker/face clustering,
fed to a local vision-LLM with a different persona prompt.

## What runs on-device

| Capability       | Model                            | Library                     |
| ---------------- | -------------------------------- | --------------------------- |
| Vision + LLM     | `lfm2-vl-450m` (int8)            | `cactus-react-native`       |
| Speech-to-text   | `whisper-base` (int8)            | `cactus-react-native`       |
| VAD / speaker    | `silero-vad` + speaker embeddings | `cactus-react-native`       |
| TTS aloud        | system TTS (`expo-speech`)       | `expo-speech`               |
| Glasses BLE / mic / camera | —                      | `@mentra/bluetooth-sdk`     |

Speaker clustering, face clustering, and roast generation are all local and run on every audio
turn / new photo / timer tick.

## Hardware

- A pair of Mentra Live smart glasses.
- An iOS or Android phone — physical device strongly preferred (BLE + camera don't work in the
  iOS simulator).
- On Android the in-app WHIP/photo receiver is fully implemented in the starter-kit's
  `mentra-direct-receiver` native module. **On iOS the in-app photo receiver is currently stubbed
  by the starter kit** and throws `Unsupported`; photo capture will surface a recoverable error
  until either an iOS receiver is added or you point the photo webhook at a local server on the
  same network.

## Build

```bash
npm install
npx expo prebuild
npx expo run:ios       # or: npx expo run:android
```

First launch downloads ~1.2GB of models on-device (LLM + Whisper + Silero). Progress is shown in
the top bar. Models are cached after that.

If you run multiple Expo projects locally, run Metro on a non-default port so this app doesn't
attach to a different project's bundler:

```bash
RCT_METRO_PORT=8082 npx expo start --dev-client --port 8082
```

…then open `exp+roastbook://expo-development-client/?url=http://localhost:8082` once the build
is installed.

## Using the app

1. Tap **Connect**. The app scans for a paired Mentra Live and connects to the first one found.
2. Mic auto-enables when connected; the glasses stream PCM over BLE.
3. Photos are taken automatically every 10 seconds, plus once every speech turn. Tap **SNAP** to
   take one on demand.
4. The feed shows a chronological timeline of transcript turns (color-coded by speaker), photos
   (tagged with the recognized face), and roasts/hype lines from the AI.
5. Toggle **HYDE ↔ JEKYLL** in the header to flip personas.
6. Toggle **READ ALOUD** to have the phone speak each new line via TTS.
7. Tap the people pill (`👥 N`) to open the People sheet, rename Speakers and Faces, and mark
   yourself with **I'M THIS** to exclude yourself from roasts.

## Glasses button shortcuts

- Short press → take a photo right now.
- Long press → toggle the glasses mic on/off.

## Tests

A Maestro UI smoke test lives at `maestro/smoke.yaml`. It launches the app, flips Hyde↔Jekyll,
toggles TTS, and opens the People sheet, asserting visibility at each step. Screenshots land in
`maestro/screenshots/`.

```bash
maestro --device <simulator-udid> test maestro/smoke.yaml
```

If you have multiple booted simulators or physical devices, pass `--device <udid>` explicitly
(`xcrun simctl list devices booted`) or Maestro will hang waiting for a choice on stdin.

## Patches against third-party packages

None at the moment. We previously carried a `patch-package` patch against
`@mentra/bluetooth-sdk@0.1.1` to fix a 3-line `GlassesStore` → `DeviceStore` rename that
prevented iOS from compiling. That bug was fixed upstream in `@mentra/bluetooth-sdk@0.1.2`, so
we've bumped the dep and removed the patch.

## Project layout

```
src/
├── App.tsx                   # single screen, wires everything
├── store.ts                  # zustand store: turns, photos, roasts, people, settings
├── types.ts
├── sensors/
│   └── useGlassesSensors.ts  # BLE connect, mic PCM → STT, photo capture, periodic timers
├── ai/
│   ├── cactus.ts             # Cactus LM/STT/Audio init + on-demand model download
│   ├── sttPipeline.ts        # rolling PCM buffer → VAD → Whisper → speaker embed → store
│   ├── roast.ts              # vision-LLM prompted in Hyde or Jekyll persona
│   ├── speakerCluster.ts     # cosine-sim online clustering of voice embeddings
│   ├── faceCluster.ts        # cosine-sim online clustering of image embeddings
│   ├── tts.ts                # expo-speech TTS aloud
│   ├── vec.ts                # cosine + running-average helpers
│   └── wav.ts                # PCM → WAV header, sample-rate constants
└── ui/
    ├── TopBar.tsx            # logo, status pill, mode toggle, mic/TTS toggles, model progress
    ├── Feed.tsx              # timeline of turns, photos, roasts/hype
    ├── BottomBar.tsx         # SNAP / ROAST NOW (or HYPE NOW) / people sheet
    ├── PeopleSheet.tsx       # rename Speaker/Face, mark "I'm this"
    └── theme.ts              # dark theme + speaker colors + Jekyll/Hyde palettes
```

## Privacy

Roastbook does no network I/O once the on-device models are downloaded. There is no analytics,
no cloud sync, no telemetry. Photos and audio buffers live in your app's cache directory and can
be wiped via the OS. Cactus exposes a `telemetryEnabled` flag on its calls which Roastbook does
not enable.

If you record people without their knowledge, that's on you — the glasses, the app, and the
local LLM all assume you have consent.
