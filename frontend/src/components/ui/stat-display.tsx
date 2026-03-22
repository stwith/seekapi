import { cn } from "@/lib/utils";

interface StatDisplayProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "destructive" | "warning" | "muted";
}

const accentColor: Record<NonNullable<StatDisplayProps["accent"]>, string> = {
  default: "text-foreground",
  destructive: "text-red-500",
  warning: "text-orange-500",
  muted: "text-muted-foreground",
};

export function StatDisplay({
  label,
  value,
  sub,
  accent = "default",
}: StatDisplayProps) {
  const isNumeric = typeof value === "number" || /^[\d,.%$+-]+$/.test(String(value));

  return (
    <div data-testid="stat-card" className="border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tracking-tight",
          isNumeric && "font-mono",
          accentColor[accent],
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}
