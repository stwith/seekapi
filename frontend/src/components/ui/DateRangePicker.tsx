interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}

const PRESETS = [
  { label: "Last hour", hours: 1 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
  { label: "Last 30d", hours: 720 },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  function applyPreset(hours: number) {
    const now = new Date();
    const start = new Date(now.getTime() - hours * 3600_000);
    onChange({ from: start.toISOString(), to: now.toISOString() });
  }

  return (
    <div data-testid="date-range-picker" className="flex flex-wrap items-center gap-2 text-sm">
      {PRESETS.map((p) => (
        <button
          key={p.hours}
          onClick={() => applyPreset(p.hours)}
          className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
        >
          {p.label}
        </button>
      ))}
      <input
        type="datetime-local"
        value={from.slice(0, 16)}
        onChange={(e) => onChange({ from: new Date(e.target.value).toISOString(), to })}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
      />
      <span className="text-gray-500">to</span>
      <input
        type="datetime-local"
        value={to.slice(0, 16)}
        onChange={(e) => onChange({ from, to: new Date(e.target.value).toISOString() })}
        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-gray-300"
      />
    </div>
  );
}
