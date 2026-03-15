interface StatusBannerProps {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
}

export function StatusBanner({
  message,
  actionLabel,
  onAction
}: StatusBannerProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <div
      data-testid="status-banner"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[#5c5147] bg-[#352f2a] px-4 py-3 text-sm text-[#efe8dc]"
    >
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button
          data-testid="status-banner-action"
          type="button"
          onClick={onAction}
          className="rounded-full border border-[#6b5f54] bg-[#453d36] px-3 py-1.5 text-xs font-semibold text-[#f3ede4] transition hover:bg-[#50473f]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
