import type { MeetingState } from '../../shared/ipc';

interface MeetingBarProps {
  meetingState: MeetingState;
  meetingTitle: string;
  onMeetingTitleChange: (value: string) => void;
  onPrimaryAction: () => void;
  disabled?: boolean;
}

const labels: Record<MeetingState, string> = {
  idle: 'Start Recording',
  recording: 'Stop Recording',
  stopped: 'Enhance Notes',
  enhancing: 'Enhancing Notes',
  enhance_failed: 'Enhancement Failed',
  done: 'Resume Recording'
};

const statusTone: Record<MeetingState, string> = {
  idle: 'bg-zinc-400',
  recording: 'bg-red-500',
  stopped: 'bg-amber-500',
  enhancing: 'bg-blue-500',
  enhance_failed: 'bg-orange-500',
  done: 'bg-emerald-500'
};

export function MeetingBar({
  meetingState,
  meetingTitle,
  onMeetingTitleChange,
  onPrimaryAction,
  disabled = false
}: MeetingBarProps): JSX.Element {
  const titleLocked = meetingState === 'recording' || meetingState === 'enhancing';

  return (
    <div
      data-testid="meeting-bar"
      className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-zinc-200 bg-white/85 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex flex-1 flex-wrap items-end gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${statusTone[meetingState]}`} />
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Meeting State</p>
            <p data-testid="meeting-state-value" className="text-sm font-semibold text-ink">
              {meetingState}
            </p>
          </div>
        </div>
        <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Meeting Title</span>
          <input
            data-testid="meeting-title-input"
            type="text"
            value={meetingTitle}
            onChange={(event) => onMeetingTitleChange(event.currentTarget.value)}
            disabled={disabled || titleLocked}
            placeholder="Weekly sync"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-100"
          />
        </label>
      </div>
      <button
        data-testid="meeting-primary-action"
        type="button"
        disabled={disabled}
        onClick={onPrimaryAction}
        className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {labels[meetingState]}
      </button>
    </div>
  );
}
