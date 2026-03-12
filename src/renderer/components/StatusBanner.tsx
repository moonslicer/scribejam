interface StatusBannerProps {
  message: string | null;
}

export function StatusBanner({ message }: StatusBannerProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <div data-testid="status-banner" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {message}
    </div>
  );
}
