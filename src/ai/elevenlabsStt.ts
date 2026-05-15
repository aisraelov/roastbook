import { ELEVENLABS_API_KEY } from './env';
import type { DiarizedSegment, TranscribeResult } from './openai';

type ScribeWord = {
  text: string;
  type?: 'word' | 'spacing' | 'audio_event';
  start?: number;
  end?: number;
  speaker_id?: string;
};

type ScribeResponse = {
  text?: string;
  words?: ScribeWord[];
};

// Roll a list of {word, speaker_id} into one segment per contiguous speaker run.
function segmentsFromWords(words: ScribeWord[]): DiarizedSegment[] {
  const segments: DiarizedSegment[] = [];
  let cur: DiarizedSegment | null = null;
  for (const w of words) {
    if (w.type && w.type !== 'word') {
      if (cur && w.text) cur.text += w.text;
      continue;
    }
    const speaker = w.speaker_id ?? 'speaker_0';
    if (!cur || cur.speaker !== speaker) {
      if (cur) segments.push(cur);
      cur = {
        start: w.start ?? 0,
        end: w.end ?? w.start ?? 0,
        text: w.text ?? '',
        speaker,
      };
    } else {
      cur.text += (cur.text.endsWith(' ') ? '' : ' ') + (w.text ?? '');
      if (w.end != null) cur.end = w.end;
    }
  }
  if (cur) segments.push(cur);
  return segments.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text);
}

export async function transcribeWithElevenLabs(
  fileUri: string,
  fileName = 'audio.wav',
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`,
    type: 'audio/wav',
    name: fileName,
  } as unknown as Blob);
  form.append('model_id', 'scribe_v1');
  form.append('diarize', 'true');
  form.append('tag_audio_events', 'false');
  form.append('language_code', 'en');

  const resp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    body: form,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs STT ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as ScribeResponse;
  const text = (data.text ?? '').trim();
  const segments = data.words ? segmentsFromWords(data.words) : [];
  return { text, segments };
}
