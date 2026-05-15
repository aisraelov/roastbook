import { ANTHROPIC_API_KEY } from './env';

// Strip the "data:image/...;base64," prefix if present and return raw b64.
function rawB64(dataUrlOrB64: string): string {
  const i = dataUrlOrB64.indexOf('base64,');
  return i >= 0 ? dataUrlOrB64.slice(i + 'base64,'.length) : dataUrlOrB64;
}

type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: 'image/jpeg'; data: string };
    };

export async function anthropicGenerateLine(
  systemPrompt: string,
  userText: string,
  imageBase64?: string,
): Promise<string> {
  const userContent: ContentBlock[] = [];
  if (imageBase64) {
    userContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: rawB64(imageBase64),
      },
    });
  }
  userContent.push({ type: 'text', text: userText });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 120,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((c) => c.type === 'text');
  return (block?.text ?? '').trim();
}
