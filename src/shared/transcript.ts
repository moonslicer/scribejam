export function normalizeTranscriptText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function areTranscriptTextsLikelySameUtterance(previous: string, next: string): boolean {
  const normalizedPrevious = normalizeTranscriptText(previous);
  const normalizedNext = normalizeTranscriptText(next);

  if (normalizedPrevious.length === 0 || normalizedNext.length === 0) {
    return false;
  }

  if (normalizedPrevious === normalizedNext) {
    return true;
  }

  const previousKey = buildTranscriptComparisonKey(normalizedPrevious);
  const nextKey = buildTranscriptComparisonKey(normalizedNext);

  if (previousKey.length === 0 || nextKey.length === 0) {
    return false;
  }

  return previousKey.startsWith(nextKey) || nextKey.startsWith(previousKey);
}

function buildTranscriptComparisonKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}
