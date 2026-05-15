import { onTurn } from './sttPipeline';
import { maybeRoast } from './roast';

export function wireRoastTriggers(): () => void {
  return onTurn(() => {
    void maybeRoast('turn');
  });
}

export { stopSpeaking } from './tts';
export { assertKeysOrThrow } from './env';
