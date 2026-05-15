import { OPENAI_API_KEY } from './env';

const BASE = 'https://api.openai.com/v1';

export type DiarizedSegment = {
  id?: number;
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type TranscribeResult = {
  text: string;
  segments: DiarizedSegment[];
};

export async function transcribeWithDiarization(
  fileUri: string,
  fileName = 'audio.wav',
): Promise<TranscribeResult> {
  // RN's FormData accepts the {uri, type, name} shape for file uploads — it
  // streams the file natively. Blob() / ArrayBuffer aren't supported in Hermes.
  const form = new FormData();
  form.append('file', {
    uri: fileUri.startsWith('file://') ? fileUri : `file://${fileUri}`,
    type: 'audio/wav',
    name: fileName,
  } as unknown as Blob);
  form.append('model', 'gpt-4o-transcribe-diarize');
  form.append('response_format', 'diarized_json');

  const resp = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI transcribe ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    text?: string;
    segments?: DiarizedSegment[];
  };
  return {
    text: (data.text ?? '').trim(),
    segments: data.segments ?? [],
  };
}

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'user';
      content: Array<
        | { type: 'input_text'; text: string }
        | { type: 'input_image'; image_url: string }
      >;
    };

// Snark/hype generation using gpt-5.4-mini with optional vision input.
// Uses the Responses API (the current OpenAI standard for multi-modal input).
export async function generateLine(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string,
): Promise<string> {
  const userContent: Array<
    | { type: 'input_text'; text: string }
    | { type: 'input_image'; image_url: string }
  > = [{ type: 'input_text', text: userText }];
  if (imageDataUrl) {
    userContent.push({ type: 'input_image', image_url: imageDataUrl });
  }

  const resp = await fetch(`${BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_output_tokens: 120,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI chat ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
    output_text?: string;
  };
  if (data.output_text) return data.output_text.trim();
  const first = data.output?.[0]?.content?.find(
    (c) => c.type === 'output_text' || typeof c.text === 'string',
  );
  return (first?.text ?? '').trim();
}
