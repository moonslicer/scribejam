import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatTranscriptSpeakerLabel,
  transcriptEntriesToText,
  type TranscriptEntry
} from '../transcript/transcript-state';

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function TranscriptPanel({ entries, isOpen, onClose }: TranscriptPanelProps): JSX.Element {
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
    <section
      data-testid="transcript-panel"
      aria-hidden={!isOpen}
      className={`fixed bottom-28 left-1/2 z-30 flex max-h-[24rem] w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#2f2a26]/96 text-[#f1ece4] shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-all duration-200 ${
        isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <div className="border-b border-white/8 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Live Transcript</h2>
            <p className="text-xs text-[#b7aea2]">Tap the activity button again to collapse.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-[#39332f] px-3 py-1 text-xs font-medium text-[#f2ede5] transition hover:bg-[#433c37]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span data-testid="transcript-count" className="text-xs text-[#b7aea2]">
            {entries.length} line{entries.length === 1 ? '' : 's'}
          </span>
          <button
            data-testid="transcript-copy-button"
            type="button"
            onClick={() => void handleCopy()}
            disabled={transcriptText.length === 0}
            className="rounded-full border border-white/10 bg-[#39332f] px-3 py-1 text-xs font-medium text-[#f2ede5] transition hover:bg-[#433c37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy Transcript
          </button>
        </div>
      </div>

      <div className="overflow-y-auto px-5 py-4">
        {copyStatus === 'copied' ? (
          <p data-testid="transcript-copy-status" className="mb-2 text-xs text-[#a4d455]">
            Copied transcript text.
          </p>
        ) : null}
        {copyStatus === 'error' ? (
          <p data-testid="transcript-copy-status" className="mb-2 text-xs text-[#f6a199]">
            Could not copy transcript. Try again.
          </p>
        ) : null}

        <div className="space-y-2 pr-1">
          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-[#38312d] px-4 py-6 text-sm text-[#b7aea2]">
              Transcript will appear here while recording.
            </p>
          ) : null}

          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/8 bg-[#38312d] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#a79d91]">
                {formatTranscriptSpeakerLabel(entry.speaker)} • {formatTime(entry.ts)} {!entry.isFinal ? '• live' : ''}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#f3eee6]">{entry.text}</p>
            </div>
          ))}

          <div ref={endRef} />
        </div>
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
