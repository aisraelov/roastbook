import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import BluetoothSdk, {
  DeviceModels,
  type ButtonPressEvent,
  type MicPcmEvent,
  type PhotoResponseEvent,
  type GlassesStatus,
  type BluetoothStatus,
  type Device,
} from '@mentra/bluetooth-sdk';
import MentraDirectReceiver, {
  type DirectPhotoUploadEvent,
} from '../../modules/mentra-direct-receiver';
import { useStore } from '../store';
import { pushPcm, startSttPipeline, stopSttPipeline } from '../ai/sttPipeline';
import { maybeRoast } from '../ai/roast';

const PHOTO_APP_ID = 'com.israelov.roastbook';

type SensorsAPI = {
  startScan: () => Promise<void>;
  stopScan: () => Promise<void>;
  connectDevice: (device: { id: string; name: string; model: string }) => Promise<void>;
  connectDefault: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  takePhoto: () => Promise<void>;
};

let receiverUploadUrl: string | null = null;
let photoInFlight = false;
let photoInFlightSince = 0;
const PHOTO_INFLIGHT_TIMEOUT_MS = 12000;

async function ensurePhotoReceiver(): Promise<string | null> {
  if (receiverUploadUrl) return receiverUploadUrl;
  try {
    const r = await MentraDirectReceiver.startPhotoReceiver();
    receiverUploadUrl = r.uploadUrl;
    useStore.getState().log('info', 'photo', `receiver up at ${r.uploadUrl}`);
    return receiverUploadUrl;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    useStore
      .getState()
      .log(
        'warn',
        'photo',
        Platform.OS === 'ios'
          ? `iOS receiver stub: photos disabled (${msg})`
          : `receiver failed: ${msg}`,
      );
    return null;
  }
}

async function takePhotoOnce(): Promise<void> {
  // Avoid hammering the firmware: only one photo request in flight at a time,
  // released either by a 'photoUpload' event or a 12s timeout fallback.
  if (photoInFlight && Date.now() - photoInFlightSince < PHOTO_INFLIGHT_TIMEOUT_MS) {
    useStore.getState().log('info', 'photo', 'skip: previous still in flight');
    return;
  }
  const upload = await ensurePhotoReceiver();
  if (!upload) return;
  const requestId = `roast-${Date.now()}`;
  photoInFlight = true;
  photoInFlightSince = Date.now();
  useStore.getState().log('info', 'photo', `requesting ${requestId}`);
  try {
    await BluetoothSdk.photoRequest(
      requestId,
      PHOTO_APP_ID,
      'medium',
      upload,
      null,
      'medium',
      false,
      false,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    useStore.getState().log('error', 'photo', `request failed: ${msg}`);
    photoInFlight = false;
  }
}

export function notePhotoArrived() {
  photoInFlight = false;
}

export function useGlassesSensors(): SensorsAPI {
  const photoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roastTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const subs: Array<{ remove: () => void } | (() => void)> = [];
    const log = useStore.getState().log;

    log('info', 'sensors', 'hook mounted, registering listeners');

    subs.push(
      BluetoothSdk.onGlassesStatus((status: Partial<GlassesStatus>) => {
        const conn = status.connection?.state;
        if (conn) log('info', 'glasses_status', `connection.state=${conn}`);
        if (conn === 'connected') {
          useStore.getState().setPresence({
            state: 'connected',
            deviceModel: status.deviceModel,
            batteryLevel: status.batteryLevel,
          });
          useStore.getState().setScanning(false);
        } else if (conn === 'scanning' || conn === 'bonding') {
          useStore.getState().setPresence({ state: 'scanning' });
        } else if (conn === 'connecting') {
          useStore.getState().setPresence({ state: 'connecting' });
        } else if (conn === 'disconnected') {
          useStore.getState().setPresence({ state: 'idle' });
        }
      }),
    );

    subs.push(
      BluetoothSdk.onBluetoothStatus((status: Partial<BluetoothStatus>) => {
        if (typeof status.searching === 'boolean') {
          useStore.getState().setScanning(status.searching);
        }
        if (status.searchResults) {
          const results = status.searchResults.map((d: Device) => ({
            id: d.id,
            name: d.name,
            model: d.model,
            rssi: d.rssi,
          }));
          useStore.getState().setScanResults(results);
          log(
            'info',
            'bluetooth_status',
            `searchResults=${results.length} ${results.map((r) => `${r.name}@${r.rssi ?? '?'}`).join(', ')}`,
          );
        }
      }),
    );

    subs.push(
      BluetoothSdk.addListener('device_discovered', (device: Device) => {
        log(
          'info',
          'device_discovered',
          `${device.name} (${device.model}) rssi=${device.rssi ?? '?'}`,
        );
      }),
    );

    subs.push(
      BluetoothSdk.addListener('button_press', (p: ButtonPressEvent) => {
        log('info', 'button_press', `${p.buttonId}/${p.pressType}`);
        if (p.pressType === 'short') {
          void takePhotoOnce();
        } else if (p.pressType === 'long') {
          const cur = useStore.getState().settings.micEnabled;
          useStore.getState().setSettings({ micEnabled: !cur });
        }
      }),
    );

    let pcmCount = 0;
    subs.push(
      BluetoothSdk.addListener('mic_pcm', (p: MicPcmEvent) => {
        const bytes = new Uint8Array(p.pcm.byteLength);
        bytes.set(new Uint8Array(p.pcm));
        pushPcm(bytes);
        pcmCount += 1;
        if (pcmCount % 50 === 0) {
          log('info', 'mic_pcm', `received ${pcmCount} frames`);
        }
      }),
    );

    subs.push(
      BluetoothSdk.addListener('local_transcription', (p: any) => {
        if (typeof p?.text === 'string') {
          if (!p.isFinal) useStore.getState().setPartial(p.text);
          log('info', 'local_transcription', `${p.isFinal ? 'final' : 'partial'}: ${p.text}`);
        }
      }),
    );

    subs.push(
      BluetoothSdk.addListener('photo_response', (p: PhotoResponseEvent) => {
        if (p.state === 'error') {
          photoInFlight = false;
          log('error', 'photo_response', `${p.errorCode ?? p.errorMessage ?? 'unknown'}`);
        } else {
          log('info', 'photo_response', `success ${p.requestId}`);
        }
      }),
    );

    subs.push(
      MentraDirectReceiver.addListener(
        'photoUpload',
        (p: DirectPhotoUploadEvent) => {
          log('info', 'photoUpload', `${Math.round(p.byteCount / 1024)}KB ${p.fileUri}`);
          photoInFlight = false;
          useStore.getState().addPhoto({
            fileUri: p.fileUri,
            byteCount: p.byteCount,
            capturedAt: Date.now(),
            facePersonIds: [],
          });
        },
      ),
    );

    return () => {
      log('info', 'sensors', 'hook unmounting');
      for (const s of subs) {
        if (typeof s === 'function') s();
        else if (s && typeof s.remove === 'function') s.remove();
      }
    };
  }, []);

  // mic on/off following settings
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.settings.micEnabled !== prev.settings.micEnabled) {
        useStore.getState().log('info', 'mic', `toggle -> ${s.settings.micEnabled}`);
        if (s.settings.micEnabled) {
          void BluetoothSdk.setMicState(true, true, true, false, false).catch(
            (e) =>
              useStore
                .getState()
                .log('error', 'mic', `setMicState(on): ${e instanceof Error ? e.message : String(e)}`),
          );
          startSttPipeline();
        } else {
          void BluetoothSdk.setMicState(false).catch(
            (e) =>
              useStore
                .getState()
                .log('error', 'mic', `setMicState(off): ${e instanceof Error ? e.message : String(e)}`),
          );
          stopSttPipeline();
        }
      }
      if (s.presence.state === 'connected' && prev.presence.state !== 'connected') {
        useStore.getState().log('info', 'mic', 'just connected; enabling mic');
        if (s.settings.micEnabled) {
          void BluetoothSdk.setMicState(true, true, true, false, false).catch(
            (e) =>
              useStore
                .getState()
                .log('error', 'mic', `setMicState(connect-time): ${e instanceof Error ? e.message : String(e)}`),
          );
          startSttPipeline();
        }
      }
    });
    return () => unsub();
  }, []);

  // periodic photos + roast tick (only while connected). Subscribe with a
  // selector so we only rebuild timers when these three values change —
  // otherwise we'd recreate the interval on every transcript / log / pcm tick
  // and end up firing 8 photoRequests/sec.
  useEffect(() => {
    let lastKey = '';
    const unsub = useStore.subscribe((s) => {
      const key = `${s.presence.state}|${s.settings.autoPhotoSeconds}|${s.settings.roastEverySeconds}`;
      if (key === lastKey) return;
      lastKey = key;

      if (photoTimerRef.current) {
        clearInterval(photoTimerRef.current);
        photoTimerRef.current = null;
      }
      if (roastTimerRef.current) {
        clearInterval(roastTimerRef.current);
        roastTimerRef.current = null;
      }
      if (s.presence.state !== 'connected') return;

      const ms = s.settings.autoPhotoSeconds * 1000;
      useStore.getState().log('info', 'photo-timer', `every ${ms}ms`);
      photoTimerRef.current = setInterval(() => {
        void takePhotoOnce();
      }, ms);

      const rms = s.settings.roastEverySeconds * 1000;
      roastTimerRef.current = setInterval(() => {
        void maybeRoast('timer');
      }, rms);
    });
    return () => {
      unsub();
      if (photoTimerRef.current) clearInterval(photoTimerRef.current);
      if (roastTimerRef.current) clearInterval(roastTimerRef.current);
    };
  }, []);

  return {
    startScan: async () => {
      const log = useStore.getState().log;
      log('info', 'scan', 'startScan(MentraLive)');
      useStore.getState().setScanResults([]);
      useStore.getState().setScanning(true);
      useStore.getState().setPresence({ state: 'scanning' });
      try {
        await BluetoothSdk.startScan(DeviceModels.MentraLive);
        const status = await BluetoothSdk.getBluetoothStatus();
        if (status.searchResults?.length) {
          useStore.getState().setScanResults(
            status.searchResults.map((d) => ({
              id: d.id,
              name: d.name,
              model: d.model,
              rssi: d.rssi,
            })),
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log('error', 'scan', msg);
        useStore.getState().setPresence({ state: 'error', message: msg });
        useStore.getState().setScanning(false);
      }
    },
    stopScan: async () => {
      useStore.getState().setScanning(false);
      // there's no public stopScan; rely on connect / timeout
    },
    connectDevice: async (device) => {
      const log = useStore.getState().log;
      log('info', 'connect', `${device.name} (${device.id})`);
      useStore.getState().setPresence({ state: 'connecting' });
      try {
        await BluetoothSdk.connect(
          { id: device.id, name: device.name, model: device.model as Device['model'] },
          { saveAsDefault: true, cancelExistingConnectionAttempt: true },
        );
        await BluetoothSdk.requestVersionInfo().catch(() => undefined);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log('error', 'connect', msg);
        useStore.getState().setPresence({ state: 'error', message: msg });
      }
    },
    connectDefault: async (): Promise<boolean> => {
      const log = useStore.getState().log;
      try {
        const def = await BluetoothSdk.getDefaultDevice();
        if (!def) {
          log('info', 'connect', 'no default device saved');
          return false;
        }
        log('info', 'connect', `auto-connecting default: ${def.name}`);
        useStore.getState().setPresence({ state: 'connecting' });
        await BluetoothSdk.connectDefault({
          saveAsDefault: true,
          cancelExistingConnectionAttempt: true,
        });
        await BluetoothSdk.requestVersionInfo().catch(() => undefined);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log('warn', 'connect', `default connect failed: ${msg}`);
        useStore.getState().setPresence({ state: 'idle' });
        return false;
      }
    },
    disconnect: async () => {
      useStore.getState().log('info', 'connect', 'disconnect requested');
      try {
        await BluetoothSdk.setMicState(false);
      } catch {}
      try {
        await BluetoothSdk.disconnect();
      } catch {}
      stopSttPipeline();
      useStore.getState().setPresence({ state: 'idle' });
    },
    takePhoto: takePhotoOnce,
  };
}
