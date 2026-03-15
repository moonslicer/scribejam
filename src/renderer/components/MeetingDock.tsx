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
  onEnhanceAction?: () => void;
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
  onEnhanceAction,
  onToggleTranscript
}: MeetingDockProps): JSX.Element {
  const micPercent = Math.round(clampLevel(micLevel) * 100);
  const systemPercent = Math.round(clampLevel(systemLevel) * 100);
  const isRecording = meetingState === 'recording';

  const showTranscriptToggle = meetingState === 'recording' || meetingState === 'stopped' || meetingState === 'enhance_failed' || meetingState === 'done';

  let centerContent: JSX.Element | null = null;
  if (meetingState === 'stopped' || meetingState === 'enhance_failed') {
    centerContent = (
      <button
        data-testid="generate-notes-button"
        type="button"
        disabled={disabled}
        onClick={onEnhanceAction}
        className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[#7ea218] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8db61c] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {meetingState === 'enhance_failed' ? '✦ Retry notes' : '✦ Generate notes'}
      </button>
    );
  } else if (meetingState === 'enhancing') {
    centerContent = (
      <div className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] border border-white/6 bg-[#37322e]/40 px-4 py-2.5 text-sm text-[#8b8074]">
        <span className="animate-pulse">Enhancing notes…</span>
      </div>
    );
  } else if (meetingState === 'done' && secondaryActionLabel && onSecondaryAction) {
    centerContent = (
      <button
        type="button"
        disabled={disabled}
        onClick={onSecondaryAction}
        className="flex w-full items-center justify-center gap-2 rounded-[1.2rem] border border-white/8 bg-[#37322e]/60 px-4 py-2.5 text-sm text-[#d8d1c6] transition hover:border-white/15 hover:bg-[#3d3832]"
      >
        {secondaryActionLabel}
      </button>
    );
  }

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <div
          data-testid="meeting-dock"
          className={`pointer-events-auto flex items-center gap-3 rounded-[2rem] border border-white/10 bg-[#2d2926]/92 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl ${centerContent ? 'w-full max-w-3xl' : ''}`}
        >
          {/* Left: record/activity button (+ transcript toggle when applicable) */}
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
            {showTranscriptToggle ? (
              <>
                <div className="h-5 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={onToggleTranscript}
                  aria-label={transcriptOpen ? 'Hide transcript' : 'Show transcript'}
                  className={`px-3 py-2.5 transition ${
                    transcriptOpen
                      ? 'text-[#d8d1c6]'
                      : 'text-[#9a9085] hover:text-[#d8d1c6]'
                  }`}
                >
                  <TranscriptIcon />
                </button>
              </>
            ) : null}
          </div>

          {/* Center: context-aware action area */}
          {centerContent ? (
            <div className="min-w-0 flex-1">
              {centerContent}
            </div>
          ) : null}
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

function TranscriptIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
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
