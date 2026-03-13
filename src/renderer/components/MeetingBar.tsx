import type { MeetingState } from '../../shared/ipc';

interface MeetingBarProps {
  meetingState: MeetingState;
  onPrimaryAction: () => void;
  disabled?: boolean;
}

const labels: Record<MeetingState, string> = {
  idle: 'Start Recording',
  recording: 'Stop Recording',
  stopped: 'Start New Recording',
  enhancing: 'Enhancing Notes',
  enhance_failed: 'Enhancement Failed',
  done: 'Start New Meeting'
};

const statusTone: Record<MeetingState, string> = {
  idle: 'bg-zinc-400',
  recording: 'bg-red-500',
  stopped: 'bg-amber-500',
  enhancing: 'bg-blue-500',
  enhance_failed: 'bg-orange-500',
  done: 'bg-emerald-500'
};

export function MeetingBar({ meetingState, onPrimaryAction, disabled = false }: MeetingBarProps): JSX.Element {
  return (
    <div
      data-testid="meeting-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white/85 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${statusTone[meetingState]}`} />
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Meeting State</p>
          <p data-testid="meeting-state-value" className="text-sm font-semibold text-ink">
            {meetingState}
          </p>
        </div>
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
