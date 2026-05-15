import { File, Paths } from 'expo-file-system';
import { createAudioPlayer } from 'expo-audio';
import { ELEVENLABS_API_KEY } from './env';
import { useStore } from '../store';

// Callum — "Husky Trickster" — pairs well with both Hyde (snark) and Jekyll
// (warm). Easy to swap; the voice list is on https://elevenlabs.io/voices.
const VOICE_ID = 'N2lVS1w4EtoT3dr4eOWO';
const MODEL_ID = 'eleven_flash_v2_5'; // low-latency model

async function synthesize(text: string): Promise<string> {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.85,
          // Style cranks the voice's emotional intensity — pairs with a hotter
          // delivery, which also reads as "louder."
          style: 0.8,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const file = new File(Paths.cache, `tts-${Date.now()}.mp3`);
  file.create({ intermediates: true, overwrite: true });
  file.write(bytes);
  return file.uri;
}

let currentPlayer: ReturnType<typeof createAudioPlayer> | null = null;
let speaking = false;
// Tail after playback ends, in case the mic is still capturing the room echo
// from the last few samples coming through the phone speaker.
const SPEAKING_TAIL_MS = 600;
let speakingUntil = 0;

export function isSpeaking(): boolean {
  return speaking || Date.now() < speakingUntil;
}

// Queue so back-to-back roasts don't cut each other off mid-word. Each entry
// is a function that resolves once playback (including tail) is complete.
const queue: Array<() => Promise<void>> = [];
let drainingQueue = false;

async function drainQueue() {
  if (drainingQueue) return;
  drainingQueue = true;
  while (queue.length > 0) {
    const next = queue.shift()!;
    try {
      await next();
    } catch {
      // already logged inside the task
    }
  }
  drainingQueue = false;
}

export function speakRoast(roastId: string, text: string): void {
  queue.push(async () => {
    const log = useStore.getState().log;
    try {
      const fileUri = await synthesize(text);
      log('info', 'tts', `synthesized -> ${fileUri}`);

      const player = createAudioPlayer({ uri: fileUri });
      // Max out the player's own volume. iOS still caps at the hardware
      // volume the user has the side buttons set to, but at least we're not
      // attenuating below that.
      try { player.volume = 1.0; } catch {}
      currentPlayer = player;
      speaking = true;
      log('info', 'tts', `speaking="${text.slice(0, 40)}"`);
      player.play();

      await new Promise<void>((resolve) => {
        const sub = player.addListener('playbackStatusUpdate', (status: any) => {
          if (status?.didJustFinish) {
            sub.remove();
            resolve();
          }
        });
        setTimeout(() => resolve(), 30_000);
      });

      try { player.remove(); } catch {}
      if (currentPlayer === player) currentPlayer = null;
      speaking = false;
      speakingUntil = Date.now() + SPEAKING_TAIL_MS;
      log('info', 'tts', `done (tail ${SPEAKING_TAIL_MS}ms, queue=${queue.length})`);

      useStore.getState().markRoastSpoken(roastId);
    } catch (e) {
      speaking = false;
      speakingUntil = 0;
      const msg = e instanceof Error ? e.message : String(e);
      log('error', 'tts', msg);
    }
  });
  void drainQueue();
}

export function stopSpeaking() {
  // Drain pending queue so we don't immediately play the next one.
  queue.length = 0;
  if (currentPlayer) {
    try { currentPlayer.pause(); } catch {}
    try { currentPlayer.remove(); } catch {}
    currentPlayer = null;
  }
  speaking = false;
  speakingUntil = 0;
}
