import type { ReactNode } from 'react';
import type { MeetingState } from '../../shared/ipc';

interface MeetingBarProps {
  meetingState: MeetingState;
  meetingTitle: string;
  onMeetingTitleChange: (value: string) => void;
  disabled?: boolean;
}

export function MeetingBar({
  meetingState,
  meetingTitle,
  onMeetingTitleChange,
  disabled = false
}: MeetingBarProps): JSX.Element {
  const titleLocked = meetingState === 'recording' || meetingState === 'enhancing';
  const createdAtLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  return (
    <section
      data-testid="meeting-bar"
      className="flex flex-col gap-4 px-8 pt-8"
    >
      <input
        data-testid="meeting-title-input"
        type="text"
        value={meetingTitle}
        onChange={(event) => onMeetingTitleChange(event.currentTarget.value)}
        disabled={disabled || titleLocked}
        placeholder="New note"
        className="w-full border-none bg-transparent p-0 text-[clamp(2rem,3.5vw,3.5rem)] leading-[1.05] text-ink outline-none placeholder:text-[#8d8476] disabled:cursor-default disabled:text-[#756c61]"
        style={{
          fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif'
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <MetaChip>
          <CalendarIcon />
          {createdAtLabel}
        </MetaChip>
      </div>
    </section>
  );
}

function MetaChip({ children, muted }: { children: ReactNode; muted?: boolean }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        muted
          ? 'border-[#d2c8b6] bg-transparent text-[#9b8e7e] hover:border-[#c5baa8] hover:text-[#7a6f62]'
          : 'border-[#d9cfbf] bg-[#f8f3ea] text-[#6b6257]'
      }`}
    >
      {children}
    </span>
  );
}

function CalendarIcon(): JSX.Element {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1 5h10" stroke="currentColor" strokeWidth="1.1" />
      <path d="M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
