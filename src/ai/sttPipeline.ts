import { File, Paths } from 'expo-file-system';
import { useStore } from '../store';
import type { Person, PersonId, TranscriptTurn } from '../types';
import { v4 as uuid } from 'uuid';
import {
  concat,
  MIC_SAMPLE_RATE,
  pcmDurationSeconds,
  wavBytes,
} from './wav';
import { transcribeWithElevenLabs } from './elevenlabsStt';
import { isSpeaking } from './tts';

// Tunables. Tight windows + parallel in-flight requests means transcript
// turns surface ~1.5–2.5s after you stop talking. Costs more (3x roughly)
// but the demo feels instant. Diarization quality dips slightly on short
// chunks — we live with it for hackathon velocity.
const FLUSH_INTERVAL_MS = 2000;
const MIN_FLUSH_SECONDS = 1.5;
const MAX_BUFFER_SECONDS = 8;
const MAX_PARALLEL_REQUESTS = 3;

let chunks: Uint8Array[] = [];
let bufferedBytes = 0;
let bufferStartedAt: number | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = 0;

export type TurnListener = (turn: TranscriptTurn) => void;
const listeners = new Set<TurnListener>();

export function onTurn(cb: TurnListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function pushPcm(frame: Uint8Array) {
  // Echo gate: while we're playing TTS through the phone speaker the mic on
  // the glasses picks it up and we end up transcribing the AI talking to us.
  // Drop frames during playback (and a short tail after).
  if (isSpeaking()) {
    // Also wipe any in-progress buffer so the chunk straddling start-of-speech
    // doesn't get flushed half-full.
    if (chunks.length) {
      chunks = [];
      bufferedBytes = 0;
      bufferStartedAt = null;
    }
    return;
  }
  if (bufferStartedAt === null) {
    bufferStartedAt = Date.now();
  }
  chunks.push(frame);
  bufferedBytes += frame.byteLength;
  useStore.getState().bumpPcm(frame.byteLength);
  if (pcmDurationSeconds(bufferedBytes) >= MAX_BUFFER_SECONDS) {
    void flush().catch(() => undefined);
  }
}

export function startSttPipeline() {
  if (flushTimer) {
    useStore.getState().log('info', 'stt.pipeline', 'already running');
    return;
  }
  useStore
    .getState()
    .log('info', 'stt.pipeline', `started; flush every ${FLUSH_INTERVAL_MS}ms`);
  flushTimer = setInterval(() => {
    void flush().catch(() => undefined);
  }, FLUSH_INTERVAL_MS);
}

export function stopSttPipeline() {
  if (flushTimer) {
    useStore.getState().log('info', 'stt.pipeline', 'stopped');
    clearInterval(flushTimer);
    flushTimer = null;
  }
  chunks = [];
  bufferedBytes = 0;
  bufferStartedAt = null;
}

export function setPartial(text: string) {
  useStore.getState().setPartial(text);
}

export function resetSttPipeline() {
  chunks = [];
  bufferedBytes = 0;
  bufferStartedAt = null;
}

function ensurePerson(speakerLabel: string): PersonId {
  const state = useStore.getState();
  const existing = Object.values(state.people).find(
    (p) => p.label === speakerLabel,
  );
  if (existing) return existing.id;
  const id = uuid();
  const person: Person = {
    id,
    label: speakerLabel,
    utteranceCount: 0,
    faceCount: 0,
    lastSeenAt: Date.now(),
  };
  state.upsertPerson(person);
  return id;
}

async function flush() {
  const log = useStore.getState().log;
  if (inFlight >= MAX_PARALLEL_REQUESTS) {
    log('info', 'stt.flush', `skip: ${inFlight} in flight`);
    return;
  }
  const minBytes = MIC_SAMPLE_RATE * 2 * MIN_FLUSH_SECONDS;
  if (bufferedBytes < minBytes) {
    log(
      'info',
      'stt.flush',
      `skip: ${pcmDurationSeconds(bufferedBytes).toFixed(2)}s < ${MIN_FLUSH_SECONDS}s`,
    );
    return;
  }

  const pcm = concat(chunks);
  const startedAt = bufferStartedAt ?? Date.now();
  chunks = [];
  bufferedBytes = 0;
  bufferStartedAt = null;
  inFlight += 1;

  const durationSeconds = pcmDurationSeconds(pcm.byteLength);
  log('info', 'stt.flush', `start: ${durationSeconds.toFixed(2)}s -> ElevenLabs (in-flight=${inFlight})`);

  try {
    const wav = wavBytes(pcm);

    // Persist the WAV for the in-app player.
    const file = new File(Paths.cache, `roast-mic-${Date.now()}.wav`);
    file.create({ intermediates: true, overwrite: true });
    file.write(wav);

    const sampleCount = Math.floor(pcm.byteLength / 2);
    const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = dv.getInt16(i * 2, true);
      const abs = Math.abs(s);
      if (abs > peak) peak = abs;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, sampleCount));
    const peakDb = peak > 0 ? 20 * Math.log10(peak / 32768) : -Infinity;
    const rmsDb = rms > 0 ? 20 * Math.log10(rms / 32768) : -Infinity;

    const capture = useStore.getState().addCapture({
      at: startedAt,
      fileUri: file.uri,
      durationSeconds,
      peakDb,
      rmsDb,
      vadSegments: 0,
    });

    const result = await transcribeWithElevenLabs(file.uri);
    log(
      'info',
      'stt.transcribe',
      result.text
        ? `"${result.text.slice(0, 80)}" segments=${result.segments.length}`
        : `(empty) segments=${result.segments.length}`,
    );

    if (!result.text) {
      useStore.getState().setPartial('');
      useStore.getState().updateCapture(capture.id, { dropped: 'empty' });
      return;
    }

    useStore.getState().updateCapture(capture.id, { transcript: result.text });

    // Emit one turn per diarized segment when speaker info is present;
    // otherwise emit a single turn for the whole window.
    if (result.segments.length > 0) {
      for (const seg of result.segments) {
        const text = (seg.text ?? '').trim();
        if (!text) continue;
        const personId = seg.speaker ? ensurePerson(seg.speaker) : undefined;
        const turn = useStore.getState().addTurn({
          text,
          startedAt: startedAt + seg.start * 1000,
          endedAt: startedAt + seg.end * 1000,
          personId,
        });
        for (const cb of listeners) cb(turn);
      }
    } else {
      const turn = useStore.getState().addTurn({
        text: result.text,
        startedAt,
        endedAt: Date.now(),
      });
      for (const cb of listeners) cb(turn);
    }

    useStore.getState().setPartial('');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log('error', 'stt.flush', msg);
    useStore.getState().setError(`STT: ${msg}`);
  } finally {
    inFlight -= 1;
  }
}
