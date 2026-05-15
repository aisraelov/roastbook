// Pulled from .env at Metro build time. Both keys must start with EXPO_PUBLIC_
// in .env so Expo bakes them into the JS bundle. They're embedded in the app
// binary — fine for a hackathon, do NOT ship to App Store with these in plain text.

export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';
export const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY ?? '';
export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
export const XAI_API_KEY = process.env.EXPO_PUBLIC_XAI_API_KEY ?? '';

export function assertKeysOrThrow() {
  if (!OPENAI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_OPENAI_API_KEY in .env');
  }
  if (!ELEVENLABS_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_ELEVENLABS_API_KEY in .env');
  }
  // xAI / Anthropic are roast-engine only; warn instead of hard-fail so users
  // on an older build (where the key wasn't baked into the bundle yet) still
  // get STT/TTS until they rebuild.
  if (!XAI_API_KEY) {
    console.warn('Missing EXPO_PUBLIC_XAI_API_KEY — Grok roast engine will fail until you rebuild.');
  }
  if (!ANTHROPIC_API_KEY) {
    console.warn('Missing EXPO_PUBLIC_ANTHROPIC_API_KEY — Anthropic fallback unavailable.');
  }
}
