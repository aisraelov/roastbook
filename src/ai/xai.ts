import { XAI_API_KEY } from './env';

// xAI's chat completion endpoint is OpenAI-compatible. The image input shape
// matches OpenAI's vision API: a message whose `content` is an array of
// `{type: 'text', text}` and `{type: 'image_url', image_url: {url}}` blocks.

const BASE = 'https://api.x.ai/v1';

type ChatBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export async function grokGenerateLine(
  systemPrompt: string,
  userText: string,
  imageDataUrl?: string,
): Promise<string> {
  const userContent: ChatBlock[] = [{ type: 'text', text: userText }];
  if (imageDataUrl) {
    userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }

  const resp = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 120,
      temperature: 0.85,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`xAI ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}
