import type { MeetingHistoryItem } from '../../shared/ipc';

interface MeetingsSidebarProps {
  isOpen: boolean;
  activePage: 'workspace' | 'settings';
  items: MeetingHistoryItem[];
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  selectedMeetingId: string | null;
  selectionDisabled?: boolean;
  newMeetingDisabled?: boolean;
  onToggle: () => void;
  onSearchChange: (value: string) => void;
  onSelectMeeting: (meetingId: string) => void;
  onNewMeeting: () => void;
  onOpenSettings: () => void;
  onArchiveMeeting: (meetingId: string) => void;
}

interface MeetingGroups {
  today: MeetingHistoryItem[];
  pastWeek: MeetingHistoryItem[];
  older: MeetingHistoryItem[];
}

function groupByTime(items: MeetingHistoryItem[]): MeetingGroups {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const groups: MeetingGroups = { today: [], pastWeek: [], older: [] };
  for (const item of items) {
    const d = new Date(item.createdAt);
    const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (itemDay >= todayStart) {
      groups.today.push(item);
    } else if (itemDay >= weekAgo) {
      groups.pastWeek.push(item);
    } else {
      groups.older.push(item);
    }
  }
  return groups;
}

function formatSidebarTime(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((todayStart.getTime() - itemDay.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays < 7) {
    return (
      d.toLocaleDateString(undefined, { weekday: 'short' }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MeetingItem({
  item,
  isSelected,
  disabled,
  onSelect,
  onArchive
}: {
  item: MeetingHistoryItem;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onArchive: () => void;
}): JSX.Element {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group relative mx-2 mb-1 cursor-pointer rounded-xl border px-3 py-2.5 transition ${
        isSelected
          ? 'border-[#7ea218]/25 bg-[#1e1b18]'
          : 'border-white/6 bg-[#37322e]/50 hover:border-white/12 hover:bg-[#3d3832]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      {/* pr-7 leaves room for the archive button so title never overlaps it */}
      <p className={`truncate pr-7 text-sm font-medium leading-snug ${isSelected ? 'text-[#f3eee8]' : 'text-[#d8d1c6]'}`}>
        {item.title}
      </p>
      <p className={`mt-0.5 text-xs ${isSelected ? 'text-[#9a9085]' : 'text-[#6b6257]'}`}>
        {formatSidebarTime(item.createdAt)}
      </p>

      {/* Archive button — absolutely positioned inside the card */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        title="Archive meeting"
        aria-label={`Archive ${item.title}`}
        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-0 transition group-hover:opacity-100 ${
          isSelected
            ? 'text-[#6b6257] hover:bg-white/10 hover:text-[#d8d1c6]'
            : 'text-[#6b6257] hover:bg-white/8 hover:text-[#9a9085]'
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <rect x="1" y="1.5" width="11" height="2.5" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M2 4.5v6a1 1 0 001 1h7a1 1 0 001-1v-6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M5 7h3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function MeetingGroup({
  label,
  items,
  selectedMeetingId,
  selectionDisabled,
  onSelectMeeting,
  onArchiveMeeting
}: {
  label: string;
  items: MeetingHistoryItem[];
  selectedMeetingId: string | null;
  selectionDisabled: boolean;
  onSelectMeeting: (id: string) => void;
  onArchiveMeeting: (id: string) => void;
}): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5a5248]">
        {label}
      </p>
      {items.map((item) => (
        <MeetingItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedMeetingId}
          disabled={selectionDisabled}
          onSelect={() => onSelectMeeting(item.id)}
          onArchive={() => onArchiveMeeting(item.id)}
        />
      ))}
    </div>
  );
}

export function MeetingsSidebar({
  isOpen,
  activePage,
  items,
  isLoading,
  errorMessage,
  searchQuery,
  selectedMeetingId,
  selectionDisabled = false,
  newMeetingDisabled = false,
  onToggle,
  onSearchChange,
  onSelectMeeting,
  onNewMeeting,
  onOpenSettings,
  onArchiveMeeting
}: MeetingsSidebarProps): JSX.Element {
  const groups = groupByTime(items);

  return (
    <aside
      data-testid="meetings-sidebar"
      className={`flex flex-shrink-0 flex-col border-r border-white/8 bg-[#2d2926] transition-[width] duration-200 ${
        isOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`}
    >
      {/* Header */}
      <div className="px-4 pb-3 pt-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[#6b6257]">Scribejam</p>
      </div>

      {/* New Meeting button */}
      <div className="px-3 pb-3">
        <button
          type="button"
          disabled={newMeetingDisabled}
          onClick={onNewMeeting}
          className="flex w-full items-center gap-2 rounded-lg bg-[#7ea218] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#8db61c] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path
              d="M6.5 2v9M2 6.5h9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          New Meeting
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <input
          data-testid="meeting-history-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          placeholder="Search meetings…"
          className="w-full rounded-lg border border-white/10 bg-[#37322e] px-3 py-1.5 text-sm text-[#f3eee8] outline-none transition placeholder:text-[#6b6257] focus:border-white/20"
        />
      </div>

      {/* Meeting list */}
      <div className="flex-1 overflow-y-auto py-1 pb-4">
        {isLoading ? (
          <p className="px-4 py-2 text-xs text-zinc-500">Loading…</p>
        ) : null}
        {errorMessage ? (
          <p className="mx-3 mb-2 rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </p>
        ) : null}
        {!isLoading && items.length === 0 ? (
          <p className="px-4 py-2 text-xs text-[#6b6257]">No meetings yet.</p>
        ) : null}
        <MeetingGroup
          label="Today"
          items={groups.today}
          selectedMeetingId={selectedMeetingId}
          selectionDisabled={selectionDisabled}
          onSelectMeeting={onSelectMeeting}
          onArchiveMeeting={onArchiveMeeting}
        />
        <MeetingGroup
          label="Past 7 Days"
          items={groups.pastWeek}
          selectedMeetingId={selectedMeetingId}
          selectionDisabled={selectionDisabled}
          onSelectMeeting={onSelectMeeting}
          onArchiveMeeting={onArchiveMeeting}
        />
        <MeetingGroup
          label="Older"
          items={groups.older}
          selectedMeetingId={selectedMeetingId}
          selectionDisabled={selectionDisabled}
          onSelectMeeting={onSelectMeeting}
          onArchiveMeeting={onArchiveMeeting}
        />
      </div>

      <div className="border-t border-white/8 px-3 py-3">
        <button
          data-testid="meetings-sidebar-settings-button"
          type="button"
          onClick={onOpenSettings}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activePage === 'settings'
              ? 'bg-[#37322e] text-[#f3eee8]'
              : 'text-[#9a9085] hover:bg-[#37322e] hover:text-[#f3eee8]'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path
              d="M6.5 1.5v1.3M6.5 10.2v1.3M11.5 6.5h-1.3M2.8 6.5H1.5M10.04 2.96l-.92.92M3.88 9.12l-.92.92M10.04 10.04l-.92-.92M3.88 3.88l-.92-.92"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <circle cx="6.5" cy="6.5" r="2.1" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
