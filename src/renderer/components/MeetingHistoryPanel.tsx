import type { MeetingHistoryItem } from '../../shared/ipc';

interface MeetingHistoryPanelProps {
  items: MeetingHistoryItem[];
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  selectedMeetingId: string | null;
  selectionDisabled?: boolean;
  onSearchChange: (value: string) => void;
  onSelectMeeting: (meetingId: string) => void;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Saved meeting';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatMeetingState(item: MeetingHistoryItem): string {
  if (item.hasEnhancedOutput) {
    return 'Enhanced';
  }
  if (item.state === 'recording') {
    return 'Recording';
  }
  if (item.state === 'stopped') {
    return 'Stopped';
  }
  if (item.state === 'enhance_failed') {
    return 'Enhancement failed';
  }
  if (item.state === 'done') {
    return 'Done';
  }

  return 'Draft';
}

export function MeetingHistoryPanel({
  items,
  isLoading,
  errorMessage,
  searchQuery,
  selectedMeetingId,
  selectionDisabled = false,
  onSearchChange,
  onSelectMeeting
}: MeetingHistoryPanelProps): JSX.Element {
  return (
    <aside
      data-testid="meeting-history-panel"
      className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">History</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Past meetings</h2>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {items.length}
        </span>
      </div>

      <label className="mt-4 flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Search</span>
        <input
          data-testid="meeting-history-search"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search titles and enhanced notes"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200"
        />
      </label>

      {errorMessage ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading meeting history…</p>
        ) : null}
        {!isLoading && items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
            No saved meetings match this search yet.
          </p>
        ) : null}
        {items.map((item) => (
          <button
            key={item.id}
            data-testid="meeting-history-item"
            type="button"
            disabled={selectionDisabled}
            onClick={() => onSelectMeeting(item.id)}
            className={`rounded-xl border px-3 py-3 text-left transition ${
              item.id === selectedMeetingId
                ? 'border-zinc-900 bg-zinc-950 text-white shadow-sm'
                : 'border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 hover:bg-white'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-sm font-semibold ${item.id === selectedMeetingId ? 'text-white' : 'text-ink'}`}>
                  {item.title}
                </h3>
                <p
                  className={`mt-1 text-xs ${
                    item.id === selectedMeetingId ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  {formatUpdatedAt(item.updatedAt)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                  item.id === selectedMeetingId
                    ? 'bg-white/15 text-white'
                    : 'bg-white text-zinc-600'
                }`}
              >
                {formatMeetingState(item)}
              </span>
            </div>
            {item.previewText ? (
              <p
                className={`mt-3 line-clamp-3 text-sm ${
                  item.id === selectedMeetingId ? 'text-zinc-100' : 'text-zinc-700'
                }`}
              >
                {item.previewText}
              </p>
            ) : (
              <p
                className={`mt-3 text-sm ${
                  item.id === selectedMeetingId ? 'text-zinc-300' : 'text-zinc-400'
                }`}
              >
                No saved notes or enhancement preview yet.
              </p>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
