interface AudioLevelProps {
  label: string;
  value: number;
}

export function AudioLevel({ label, value }: AudioLevelProps): JSX.Element {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-75" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
