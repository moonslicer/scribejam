import { useEffect, useRef } from 'react';

export interface TranscriptEntry {
  id: string;
  ts: number;
  text: string;
  speaker: 'you' | 'them';
  isFinal: boolean;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function TranscriptPanel({ entries }: TranscriptPanelProps): JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries]);

  return (
    <section data-testid="transcript-panel" className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Live Transcript</h2>
        <span data-testid="transcript-count" className="text-xs text-zinc-500">
          {entries.length} line{entries.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">Transcript will appear after recording starts.</p>
        ) : null}

        {entries.map((entry) => (
          <div key={entry.id} className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              {entry.speaker} • {formatTime(entry.ts)} {!entry.isFinal ? '• live' : ''}
            </p>
            <p className="mt-1 text-sm text-zinc-800">{entry.text}</p>
          </div>
        ))}

        <div ref={endRef} />
      </div>
    </section>
  );
}
