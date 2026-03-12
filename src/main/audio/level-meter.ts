export function computeRms(samples: Int16Array): number {
  if (samples.length === 0) {
    return 0;
  }

  let squared = 0;
  for (const sample of samples) {
    const normalized = sample / 32768;
    squared += normalized * normalized;
  }

  const rms = Math.sqrt(squared / samples.length);
  if (!Number.isFinite(rms)) {
    return 0;
  }
  return Math.max(0, Math.min(1, rms));
}
