# Feedback on `@mentra/bluetooth-sdk` — Round 2

Round 1 lives in `FEEDBACK.md`; the major blockers from there are fixed. New
issues, mostly surfaced while moving Roastbook from a fully-local STT/LLM
stack onto cloud STT (OpenAI / ElevenLabs Scribe) and a cloud roast engine
(Anthropic Claude Haiku 4.5). Posted in priority order.

## Bugs

### 1. Starter-kit RN example fails to build on iOS out of the box (GStreamer missing)

**Reproduces on a pristine clone**, following the README exactly:

```bash
git clone https://github.com/Mentra-Community/Mentra-Bluetooth-SDK-Starter-Kit.git
cd Mentra-Bluetooth-SDK-Starter-Kit/examples/react-native
npm install
npx expo prebuild --platform ios --clean
npx expo run:ios --device "iPhone 16"
```

Fails with:

```
❌  Pods/MentraDirectReceiver: 'gst/gst.h' file not found
   └─ modules/mentra-direct-receiver/ios/gst_ios_init.h:4:10
❌  Pods/MentraDirectReceiver: 'gst/app/gstappsink.h' file not found
   └─ modules/mentra-direct-receiver/ios/GStreamerWhipReceiver.m:6:9
CommandError: Failed to build iOS project. "xcodebuild" exited with error code 65.
```

Root cause: `modules/mentra-direct-receiver/ios/MentraDirectReceiver.podspec`
hard-links GStreamer (`gst/*.h`, `GStreamer.framework`) from
`~/Library/Developer/GStreamer/iPhone.sdk`. The example RN README at
`examples/react-native/README.md` doesn't mention this requirement, and there's
no `setup-gstreamer-ios.sh` to mirror the Android one in `modules/mentra-direct-receiver/scripts/`.

This blocks **anyone** from running the iOS example app on a Mac that doesn't
already have the GStreamer iOS SDK installed at the magic path — including
people who only want to use the photo receiver and have no interest in WebRTC.

Three sub-issues here:

1. **README doesn't surface the GStreamer requirement.** If GStreamer is
   intentionally a hard dep, the README needs a "Prerequisites: macOS GStreamer
   SDK 1.x at `~/Library/Developer/GStreamer/iPhone.sdk` — download from
   `https://gstreamer.freedesktop.org/data/pkg/ios/`" section, and ideally a
   `scripts/setup-gstreamer-ios.sh` to automate it.

2. **No way to opt out of WebRTC.** Apps that only need the photo receiver
   shouldn't pay the multi-GB GStreamer SDK install cost. Splitting the module
   into two podspec source-file globs — photo-only (uses just `Network.framework`)
   and webrtc-optional (uses GStreamer) — would unblock the common case.

3. **The WebRTC path's "host a WHIP receiver in-app" design is itself
   questionable for an SDK example.** Most iOS apps that need a WebRTC stream
   would reach for `WebRTC.framework` (or LiveKit) which is single-pod, no
   external SDK install, and ships through CocoaPods cleanly. GStreamer-iOS is
   a heavy, finicky dependency that probably shouldn't be the default
   recommendation in a Bluetooth-SDK starter kit.

**Local workaround we applied in Roastbook:** delete `gst_ios_init.h/m`,
`GStreamerWhipReceiver.h/m`, `WhipHeaderProxy.swift`, strip the GStreamer
sections from `MentraDirectReceiver.podspec`, and stub `startWebRtcReceiver`
to `throw`. Photo receiver works fine after that.

### 2. `BluetoothSdk.setMicState(..., bypassVad=false)` mangles audio for any external STT

By default Roastbook called `setMicState(true, true, false, true, false)` —
`bypassVad=false`, which routes glasses PCM through the SDK's own internal
Silero VAD before emitting `mic_pcm` events. The resulting audio stream is
chunked / chopped in irregular bursts depending on the SDK's VAD decisions:

- Beginning of utterances is sometimes cut off (pre-VAD-trigger frames are
  dropped).
- Tail of utterances is sometimes cut off (silence after VAD says "done").
- Frames arrive in irregular bursts that produce subtle audio discontinuities
  on the consumer side.

When we fed this audio to Whisper-base / Whisper-small (local Cactus) we got
the classic "to to to to to" hallucination loop because Whisper hates
discontinuities. Switching to `bypassVad=true` (matching the starter kit's
known-working playback recipe) gave us continuous audio and downstream STT
started returning real transcripts.

**Ask:** make `bypassVad` default to `true` for `setMicState`, or at least
document loudly that **`bypassVad=false` is suitable only for the SDK's own
internal transcriber, NOT for piping PCM into a third-party STT**. Right now
the parameter looks innocuous and the discoverability cost is debugging an
unrelated-looking STT hallucination problem.

### 3. `MicPcmEvent` payload has no metadata fields

```ts
export type MicPcmEvent = {
    type: "mic_pcm";
    pcm: ArrayBuffer;
};
```

Sample rate, bit depth, channel count, and "is this raw 16k PCM or was VAD
applied first" are all implicit. We had to read native Swift to confirm 16
kHz / 16-bit / mono / signed / little-endian. Please add these as fields on
the event so consumers don't have to read the pod source:

```ts
export type MicPcmEvent = {
    type: "mic_pcm";
    pcm: ArrayBuffer;
    sampleRate: 16000;
    bitsPerSample: 16;
    channels: 1;
    encoding: 'pcm_s16le';
    vadGated: boolean;
};
```

(Same gap exists for `MicLc3Event` — payload size? Frame size? Bitrate?)

### 4. `connectFirst` blocks the UI without exposing scan progress

`BluetoothSdk.connectFirst(DeviceModels.MentraLive)` is a "trust me, I'll pick
something" API: returns the first device discovered, no way to surface the
in-progress scan-results list to a user-facing picker without rolling your
own `startScan` + `onBluetoothStatus` subscriber, and times out at 15s with
nothing to show.

The starter-kit's RN example demonstrates the manual path (`useMentraSdk.ts`
~lines 418–470) but it took us a while to find. We ended up writing a custom
scan-sheet that drives `startScan` + `onBluetoothStatus` and presents a list
of devices ranked by RSSI.

**Ask:** ship a first-class `BluetoothSdk.scan({ onResults, timeout })` helper
that returns a `Device[]` async iterable or callback, so apps can build a
device picker without re-implementing the same listener plumbing.

### 5. Multiple Mentra Live devices in range can confuse `connectFirst`

In a coworking space / hackathon environment with many pairs of Mentra Live
glasses nearby, `connectFirst` happily grabs whichever one it sees first.
Roastbook initially connected to a teammate's glasses instead of mine because
they were powered on slightly earlier. RSSI / explicit-pick UI is the right
answer here — see #4.

### 6. The `searchResults` array sometimes returns `rssi=?` immediately, then fills in later

In one log we saw:

```
[bluetooth_status] searchResults=1 Mentra_Live_E7FA@?
[device_discovered] Mentra_Live_E7FA (Mentra Live) rssi=?
[bluetooth_status] searchResults=2 Mentra_Live_E7FA@?, Mentra_Live_DA59@-74
```

`E7FA` has no RSSI even though it's the same device that 5 seconds later
reports `rssi=-49`. We display devices ranked by RSSI in our picker; the `?`
entries effectively get sorted last and look broken. Probably worth
populating RSSI on first discovery rather than null-then-update, or
documenting that `rssi` may be `undefined` initially.

### 7. Rapid `BluetoothSdk.photoRequest()` calls queue up at the firmware level and may not all fire

When we had a buggy timer firing `photoRequest` ~8 times in 6 seconds, the
glasses just stopped taking photos. No error event, no `photo_response` —
silent drop. The phone-side receiver kept logging "requesting roast-..." but
no `photoUpload` events ever fired. Once we fixed the timer to one request
per 10s with an in-flight gate, photos started uploading again.

**Ask:** if the firmware has a queue depth limit (or rate limit) for photo
requests, emit a `photo_response` with an `errorCode` like `rate_limited` or
`queue_full` so consumers can back off. Right now it just silently fails.

### 8. iOS background mode plumbing isn't documented in the SDK docs

The BT SDK works fine in foreground; once you lock the screen, BLE and mic
stop. The fix is `UIBackgroundModes: [bluetooth-central, audio]` in
`Info.plist` plus an `expo-audio` `setAudioModeAsync({ shouldPlayInBackground:
true, allowsBackgroundRecording: true })` call at startup. None of this is in
the BT SDK docs even though it's required for almost any practical Mentra
Live app.

**Ask:** dedicated "iOS background mode" section in the docs explaining
exactly what's required (background modes string, audio session config) for
the mic + BLE to survive a screen lock. Bonus points: mention whether the
SDK's iOS CBCentralManager opts into state restoration
(`CBCentralManagerOptionRestoreIdentifierKey`) — if it doesn't, the BLE
connection won't survive the app being terminated and relaunched on a BLE
event, and we should know.

## Smaller things

- The `BluetoothSdk.types.d.ts` `Device.id` field is sometimes the device
  name (`Mentra_Live_E7FA`) and sometimes a CoreBluetooth UUID. Worth
  documenting which.
- The default 15s `connectFirst` timeout fires with no progress signal in
  between (#4 above). Even a single `connection.state=scanning_started`
  → `scanning_in_progress` event would help.
- The iOS `MentraBluetoothSDK.swift` pod is a single ~2500-line file. Easy
  to navigate with grep, but worth splitting up for readers.
- The `BluetoothSdk.types.d.ts` `GlassesStatus` interface has ~30 fields
  flat-listed without grouping (connection vs. battery vs. firmware vs.
  wifi vs. hotspot). A grouped shape (`{ connection: {...}, battery: {...},
  network: {...} }`) would self-document.

## What's working great (since round 1)

- The `@mentra/bluetooth-sdk@0.1.2` `DeviceStore`/`GlassesStore` typo fix
  shipped fast — much appreciated. We removed our `patch-package` workaround.
- The new iOS `mentra-direct-receiver` photo flow (once you strip GStreamer)
  is solid: `startPhotoReceiver` → `uploadUrl` → glasses POST a JPEG → we get
  a usable on-disk `fileUri`. Exactly the right ergonomics for a vision-LLM
  pipeline.
- `bypassVad=true` + continuous PCM is a clean, reliable signal source once
  you know to flip it.
- The on-device `Device` model has just enough info (`id`, `model`, `name`,
  `rssi`) for a custom scan picker — we built one in ~150 lines.
- The Expo plugin handling of permission strings (`NSBluetoothAlwaysUsage…`,
  Android permissions, Wifi cleartext) makes the cross-platform plumbing
  almost invisible.
