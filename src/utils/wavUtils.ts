export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBlobUrl(bytes: Uint8Array, mimeType = "audio/wav"): string {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function getWavDurationSeconds(wavBytes: Uint8Array): number {
  if (wavBytes.length < 44) return 0;
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const byteRate = view.getUint32(28, true);
  const dataSize = view.getUint32(40, true);
  if (!byteRate) return 0;
  return dataSize / byteRate;
}

export function extractWaveformPeaks(wavBytes: Uint8Array, barCount = 72): number[] {
  if (wavBytes.length <= 44) {
    return Array.from({ length: barCount }, () => 0.15);
  }

  const pcmByteLength = wavBytes.length - 44;
  const totalSamples = Math.floor(pcmByteLength / 2);
  if (totalSamples === 0) {
    return Array.from({ length: barCount }, () => 0.15);
  }

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset + 44, totalSamples * 2);
  const samplesPerBar = Math.max(1, Math.floor(totalSamples / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(totalSamples, start + samplesPerBar);
    let maxAmp = 0;
    // Stride inside bucket for fast peak scanning
    const stride = Math.max(1, Math.floor((end - start) / 64));
    for (let s = start; s < end; s += stride) {
      const sample = Math.abs(view.getInt16(s * 2, true)) / 32768;
      if (sample > maxAmp) maxAmp = sample;
    }
    peaks.push(Math.max(0.08, Math.min(1, maxAmp)));
  }

  return peaks;
}

/**
 * Concatenates multiple unary WAV clips (24kHz mono 16-bit PCM, 44-byte RIFF header)
 * by preserving the first 44-byte header, appending PCM payloads (skipping 44 bytes on
 * subsequent clips), and updating RIFF & data chunk sizes.
 */
export function mergeWavClips(base64Clips: string[]): Uint8Array | null {
  const validClips = base64Clips
    .filter((b64) => b64.length > 0)
    .map((b64) => base64ToUint8Array(b64))
    .filter((bytes) => bytes.length > 44);

  if (validClips.length === 0) return null;
  if (validClips.length === 1) return validClips[0];

  // Add a subtle 450ms silence gap (24000 Hz * 2 bytes * 0.45s = 21600 bytes, aligned to 2)
  const silenceBytesLength = 21600;
  let totalPcmBytes = 0;
  for (let i = 0; i < validClips.length; i++) {
    totalPcmBytes += validClips[i].length - 44;
    if (i < validClips.length - 1) {
      totalPcmBytes += silenceBytesLength;
    }
  }

  const merged = new Uint8Array(44 + totalPcmBytes);
  // Copy 44-byte header from first clip
  merged.set(validClips[0].subarray(0, 44), 0);

  let offset = 44;
  for (let i = 0; i < validClips.length; i++) {
    const pcm = validClips[i].subarray(44);
    merged.set(pcm, offset);
    offset += pcm.length;
    if (i < validClips.length - 1) {
      // Uint8Array is zero-initialized, so advancing offset inserts silence
      offset += silenceBytesLength;
    }
  }

  const view = new DataView(merged.buffer);
  view.setUint32(4, 36 + totalPcmBytes, true); // RIFF chunk size
  view.setUint32(40, totalPcmBytes, true); // data subchunk size

  return merged;
}

export function downloadWavBytes(bytes: Uint8Array, filename: string): void {
  const url = uint8ArrayToBlobUrl(bytes, "audio/wav");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
