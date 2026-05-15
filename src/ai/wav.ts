export const MIC_SAMPLE_RATE = 16000;
export const MIC_CHANNELS = 1;
export const MIC_BITS_PER_SAMPLE = 16;

export function wavBytes(pcm: Uint8Array): Uint8Array {
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const writeAscii = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      bytes[offset + i] = s.charCodeAt(i);
    }
    offset += s.length;
  };
  const writeUInt16 = (v: number) => {
    view.setUint16(offset, v, true);
    offset += 2;
  };
  const writeUInt32 = (v: number) => {
    view.setUint32(offset, v, true);
    offset += 4;
  };
  writeAscii('RIFF');
  writeUInt32(36 + pcm.byteLength);
  writeAscii('WAVE');
  writeAscii('fmt ');
  writeUInt32(16);
  writeUInt16(1);
  writeUInt16(MIC_CHANNELS);
  writeUInt32(MIC_SAMPLE_RATE);
  writeUInt32((MIC_SAMPLE_RATE * MIC_CHANNELS * MIC_BITS_PER_SAMPLE) / 8);
  writeUInt16((MIC_CHANNELS * MIC_BITS_PER_SAMPLE) / 8);
  writeUInt16(MIC_BITS_PER_SAMPLE);
  writeAscii('data');
  writeUInt32(pcm.byteLength);
  bytes.set(pcm, offset);
  return bytes;
}

export function pcmDurationSeconds(byteCount: number): number {
  const bytesPerSecond =
    (MIC_SAMPLE_RATE * MIC_CHANNELS * MIC_BITS_PER_SAMPLE) / 8;
  return bytesPerSecond > 0 ? byteCount / bytesPerSecond : 0;
}

export function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export function pcmToFloat32(pcm: Uint8Array): number[] {
  const view = new DataView(
    pcm.buffer,
    pcm.byteOffset,
    pcm.byteLength,
  );
  const sampleCount = Math.floor(pcm.byteLength / 2);
  const out = new Array<number>(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const s = view.getInt16(i * 2, true);
    out[i] = s / 32768;
  }
  return out;
}
