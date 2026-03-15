import type { MeetingState, TranscriptionStatusEvent } from '../../shared/ipc';

interface MeetingDockProps {
  meetingState: MeetingState;
  transcriptOpen: boolean;
  micLevel: number;
  systemLevel: number;
  transcriptionStatus?: TranscriptionStatusEvent;
  disabled?: boolean;
  secondaryActionLabel?: string | undefined;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onToggleTranscript: () => void;
}

const recordLabel: Record<MeetingState, string> = {
  idle: 'Record',
  recording: 'Stop',
  stopped: 'Resume',
  enhancing: 'Working',
  enhance_failed: 'Retry',
  done: 'Resume'
};

const primaryLabels: Record<MeetingState, string> = {
  idle: 'Start Recording',
  recording: 'Stop Recording',
  stopped: 'Resume Recording',
  enhancing: 'Enhancing Notes',
  enhance_failed: 'Retry Enhancement',
  done: 'Resume Recording'
};

export function MeetingDock({
  meetingState,
  transcriptOpen,
  micLevel,
  systemLevel,
  transcriptionStatus,
  disabled = false,
  secondaryActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  onToggleTranscript
}: MeetingDockProps): JSX.Element {
  const micPercent = Math.round(clampLevel(micLevel) * 100);
  const systemPercent = Math.round(clampLevel(systemLevel) * 100);
  const isRecording = meetingState === 'recording';

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div
          data-testid="meeting-dock"
          className="pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-[2rem] border border-white/10 bg-[#2d2926]/92 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl"
        >
          {/* Left: record/activity button */}
          <div
            className={`flex items-center rounded-[1.4rem] border transition ${
              isRecording
                ? 'border-[#8aa71e]/40 bg-[#34322a] text-white'
                : 'border-white/8 bg-[#37322e] text-[#f1ede5]'
            }`}
          >
            <button
              data-testid="meeting-activity-toggle"
              type="button"
              disabled={disabled}
              onClick={onPrimaryAction}
              className="flex items-center gap-2 px-3 py-2.5 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AudioActivityGlyph
                active={isRecording}
                micLevel={micLevel}
                systemLevel={systemLevel}
              />
              <span className="text-sm font-medium">{recordLabel[meetingState]}</span>
            </button>
            {isRecording && (
              <button
                type="button"
                onClick={onToggleTranscript}
                className="border-l border-[#8aa71e]/30 px-2.5 py-2.5 transition hover:opacity-80"
                aria-label={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
              >
                <ChevronIcon expanded={transcriptOpen} />
              </button>
            )}
          </div>

          {/* Center: Ask anything */}
          <div className="min-w-0 flex-1 rounded-[1.2rem] border border-white/6 bg-[#37322e]/45 px-3 py-2.5 text-sm text-[#6b6257]">
            Ask anything
          </div>
        </div>
      </div>

      <div className="sr-only" aria-hidden="true">
        <span data-testid="audio-level-mic-value">{micPercent}%</span>
        <span data-testid="audio-level-system-value">{systemPercent}%</span>
        <span data-testid="meeting-state-value">{meetingState}</span>
        <span data-testid="transcription-status">{transcriptionStatus?.status ?? 'idle'}{transcriptionStatus?.detail ? ` ${transcriptionStatus.detail}` : ''}</span>
        <button
          data-testid="meeting-primary-action"
          type="button"
          disabled={disabled}
          onClick={onPrimaryAction}
        >
          {primaryLabels[meetingState]}
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            data-testid="meeting-secondary-action"
            type="button"
            disabled={disabled}
            onClick={onSecondaryAction}
          >
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
    </>
  );
}

function AudioActivityGlyph({
  active,
  micLevel,
  systemLevel
}: {
  active: boolean;
  micLevel: number;
  systemLevel: number;
}): JSX.Element {
  const bars = [
    0.25 + clampLevel(systemLevel) * 0.75,
    0.2 + clampLevel((micLevel + systemLevel) / 2) * 0.95,
    0.35 + clampLevel(micLevel) * 0.65,
    0.18 + clampLevel(Math.max(micLevel, systemLevel)) * 0.82
  ];

  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#26231f]">
      <span className="flex h-4 items-end gap-[2px]">
        {bars.map((bar, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={`w-[2.5px] rounded-full transition-[height,opacity] duration-150 ${
              active ? 'bg-[#8bb81c] opacity-100' : 'bg-[#8b857a] opacity-70'
            }`}
            style={{
              height: `${Math.max(20, Math.round(bar * 100))}%`
            }}
          />
        ))}
      </span>
    </span>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`text-[#aaa295] transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <path
        d="M4.5 6.5L8 10l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function clampLevel(value: number): number {
  return Math.max(0, Math.min(1, value));
}
