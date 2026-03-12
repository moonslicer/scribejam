import { useEffect, useMemo, useRef, useState } from 'react';
import { transcriptEntriesToText, type TranscriptEntry } from '../transcript/transcript-state';

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
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const transcriptText = useMemo(() => transcriptEntriesToText(entries), [entries]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries]);

  useEffect(() => {
    if (copyStatus === 'idle') {
      return;
    }
    const timer = setTimeout(() => {
      setCopyStatus('idle');
    }, 2000);
    return () => clearTimeout(timer);
  }, [copyStatus]);

  const handleCopy = async (): Promise<void> => {
    if (transcriptText.length === 0) {
      return;
    }
    const copied = await copyToClipboard(transcriptText);
    setCopyStatus(copied ? 'copied' : 'error');
  };

  return (
    <section data-testid="transcript-panel" className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Live Transcript</h2>
        <div className="flex items-center gap-2">
          <span data-testid="transcript-count" className="text-xs text-zinc-500">
            {entries.length} line{entries.length === 1 ? '' : 's'}
          </span>
          <button
            data-testid="transcript-copy-button"
            type="button"
            onClick={() => void handleCopy()}
            disabled={transcriptText.length === 0}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            Copy Transcript
          </button>
        </div>
      </div>

      {copyStatus === 'copied' ? (
        <p data-testid="transcript-copy-status" className="mb-2 text-xs text-emerald-700">
          Copied transcript text.
        </p>
      ) : null}
      {copyStatus === 'error' ? (
        <p data-testid="transcript-copy-status" className="mb-2 text-xs text-rose-700">
          Could not copy transcript. Try again.
        </p>
      ) : null}

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

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
