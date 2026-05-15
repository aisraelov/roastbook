# Feedback on `@mentra/bluetooth-sdk` (0.1.1)

Notes collected while building Roastbook against the BT SDK + starter-kit RN example. Posted in
priority order — first one blocks iOS builds entirely.

## Bugs

### 1. iOS pod fails to compile: `cannot find 'GlassesStore' in scope` (blocker, fixed in 0.1.2 ✅)

`ios/Source/MentraBluetoothSDK.swift` lines 2392–2394 in 0.1.1 referenced
`GlassesStore.shared.get(...)`, but the singleton in this package is `DeviceStore` (defined in
`ios/Source/DeviceStore.swift:11`). Every other call site in the same function
(`glassesStatusChanges`, lines 2386–2398) already used `DeviceStore.shared.get(...)` — looks like
a stale rename that slipped through.

The fix was a 3-line `GlassesStore` → `DeviceStore` rename. **Confirmed fixed in 0.1.2** — we
removed our local `patch-package` workaround and bumped the dep.

### 2. RN starter-kit's `mentra-direct-receiver` is Android-only

`examples/react-native/modules/mentra-direct-receiver/ios/MentraDirectReceiverModule.swift`
implements `startPhotoReceiver` and `startWebRtcReceiver` as `throw UnsupportedDirectReceiverError()`.
`MentraDirectReceiverView` is a 9-line black `ExpoView` with no rendering.

It's reasonable to ship Android-first, but the gap should be flagged loudly in the docs (and
ideally the RN example should `Platform.OS === 'ios'` branch and hide / disable the relevant UI).
Without that, an iOS developer following the docs in good faith spends a while wondering whether
they configured something wrong before realizing the entire path is stubbed.

A minimal iOS receiver path that would unblock most apps:

- **Photos**: a tiny in-process HTTP listener that accepts the same multipart body the Android
  `LocalPhotoUploadServer` accepts and writes to the cache dir. CocoaAsyncSocket or
  `URLSessionWebSocketTask` aren't needed; `Network.framework`'s `NWListener` is enough.
- **WebRTC**: WebRTC.framework's `RTCPeerConnection` + a WHIP handler. There's prior art in the
  `livekit/client-sdk-swift` repo.

Both are 1–2 days of work each but unblock the entire iOS dev population.

## Docs gaps

### 3. `BluetoothSdk.photoRequest` upload contract isn't fully specified

We can see from the starter-kit's RN code and the Android receiver that the photo arrives as
multipart form-data with a `photo` file field and a `requestId` text field, and an optional
`Authorization: Bearer <token>` header. That should be in the docs page for camera/photos, with
a curl example and the expected response shape so people writing their own webhooks can match
exactly. Today you reverse-engineer it from `LocalPhotoUploadServer.kt`.

### 4. `mic_pcm` payload format isn't specified

The docs page says "the SDK only specifies `event.pcm` exists — no details on sample rate, bit
depth, or channel count are provided." From reading `useMentraSdk.ts` in the starter kit
(constants `MIC_SAMPLE_RATE = 16000`, `MIC_CHANNEL_COUNT = 1`, `MIC_BITS_PER_SAMPLE = 16`), we
inferred it's 16 kHz mono 16-bit little-endian signed PCM. That should be one line in the docs.

### 5. There's no documented API for playing audio TO the glasses speakers

Mentra Live has a speaker. The docs note this. There appears to be no React Native API to play
arbitrary audio (an mp3, a TTS clip, a beep) through it. If this is truly not supported, the docs
should say so explicitly so people don't go looking; if it's supported via some indirect route
(e.g., classic Bluetooth A2DP audio profile after BLE pairing), that path should be documented
with the iOS / Android quirks called out (the starter kit hints at iOS requiring Settings →
Bluetooth manual selection, which is a sharp edge).

### 6. `local_transcription` event isn't in the typed events list

`useMentraSdk.ts` listens for `local_transcription` but the TypeScript event map in
`BluetoothSdk.types.d.ts` doesn't appear to include it. The payload (`{text, isFinal, ...}`)
isn't typed either. If it's a supported public API, type it; if it's internal, mark it.

### 7. API reference page is summary-only

The docs page at `/bluetooth-sdk/api-reference` lists method names by category but provides no
parameter shapes, no event payloads, no return types. For a public SDK that's the page people
need most. Either generate it from the TypeScript types or make it explicit that the source of
truth is the `.d.ts` files.

## Ergonomics

### 8. `photoRequest`'s positional args are hard to read

```ts
await BluetoothSdk.photoRequest(
  requestId,
  PHOTO_APP_ID,
  'medium',
  uploadUrl,
  null,
  'medium',
  false,
  true,
);
```

Eight positional arguments, three of them strings or booleans that look interchangeable, and
two of them confusingly both `'medium'` for different things (size and compression). Consider a
single options object:

```ts
await BluetoothSdk.photoRequest({
  requestId,
  appId: PHOTO_APP_ID,
  size: 'medium',
  webhookUrl: uploadUrl,
  authToken: null,
  compression: 'medium',
  flash: false,
  sound: true,
});
```

### 9. `setMicState`'s positional booleans are similarly opaque

```ts
await BluetoothSdk.setMicState(true, true, false, true, false);
```

Same fix: take an options object.

### 10. `MentraDirectReceiver.startPhotoReceiver()` should expose its bound port and stop reason

Right now it returns `{ host, port, uploadUrl }` on Android, which is great, but the
`receiverStatus` event payload is a free-text `message` field. Consumers end up doing string
matching like `payload.message.toLowerCase().includes('ready at')` (see `useMentraSdk.ts:835`).
Replacing that with a structured `{ state: 'ready' | 'stopped' | 'error', detail?: string }`
would prevent every consumer from re-inventing the same parser.

### 11. `connectFirst` timeout default is 15s with no progress signal

If scanning takes longer than the timeout (busy BLE radio, glasses asleep) you get a single
rejection at the end. A `connectFirst({ onScan: (devicesSeen) => …, timeoutMs: … })` would let
the UI explain why nothing's happening.

## Smaller things

- The `MentraOS` docs site (`docs.mentraglass.com`) and the Bluetooth SDK docs site
  (`bluetooth-sdk-hackathon.ngrok.app/bluetooth-sdk/...`) are clearly different surfaces, but
  search across the docs MCP currently returns MentraOS-only results. We almost reached for the
  wrong APIs because of this.
- The example app's `useMentraSdk.ts` is ~2300 lines and serves as both the canonical reference
  and a demo. Splitting it into thin per-domain hooks (`useGlassesConnection`, `useGlassesPhoto`,
  `useGlassesMic`, `useGlassesStream`) would make it more useful as a copy-paste reference.
- The `RGB LED control`, `dashboard menu`, and `WiFi credential push` APIs all look like they'd
  be incredible building blocks for hackathon projects, but they don't show up in any cookbook
  example we found. A "10 things you can build in 50 lines of code each" page would be very high
  ROI.

## What worked great

- The `connectFirst(DeviceModels.MentraLive)` flow is dead simple — exactly the right abstraction
  for an MVP.
- The starter-kit's RN example, despite the iOS receiver gap, is an excellent reference for
  every other event and shape. We read more of it than the docs.
- The PCM frames over BLE worked out of the box on Android, no setup ceremony beyond
  `setMicState(true, true, false, true, false)`.
- Photo uploads over the in-app receiver are very nice — getting back a real on-disk `fileUri`
  that we can hand straight to a vision model with no decoding step is exactly what you want.
- The `@mentra/bluetooth-sdk` Expo config plugin handled all of the iOS / Android permission
  plumbing — no manual `Info.plist` editing required.
