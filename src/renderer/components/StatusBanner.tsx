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
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button
          data-testid="status-banner-action"
          type="button"
          onClick={onAction}
          className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:border-amber-400"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
