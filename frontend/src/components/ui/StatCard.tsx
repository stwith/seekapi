interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "teal" | "red" | "orange" | "gray";
}

const accentBorder: Record<string, string> = {
  teal: "border-l-primary-500",
  red: "border-l-red-500",
  orange: "border-l-orange-500",
  gray: "border-l-gray-400",
};

export function StatCard({ label, value, sub, accent = "teal" }: StatCardProps) {
  return (
    <div
      data-testid="stat-card"
      className={`rounded-lg bg-gray-800 border-l-4 ${accentBorder[accent]} p-4`}
    >
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
