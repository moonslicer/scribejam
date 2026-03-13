export function formatDefaultMeetingTitle(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(at);

  const month = partValue(parts, 'month');
  const day = partValue(parts, 'day');
  const hour = partValue(parts, 'hour');
  const minute = partValue(parts, 'minute');

  return `${month} ${day} ${hour}:${minute}`;
}

export function resolveMeetingTitle(title: string, at: Date = new Date()): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : formatDefaultMeetingTitle(at);
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}
