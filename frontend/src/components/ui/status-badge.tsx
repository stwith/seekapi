import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/shadcn/badge";

type BadgeVariant =
  | "active"
  | "disabled"
  | "error"
  | "pending"
  | "healthy"
  | "degraded"
  | "unavailable"
  | "suspended";

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
}

const variantConfig: Record<
  BadgeVariant,
  { badge: "default" | "secondary" | "destructive" | "outline"; dot: string }
> = {
  active: { badge: "default", dot: "bg-emerald-500" },
  healthy: { badge: "default", dot: "bg-emerald-500" },
  disabled: { badge: "secondary", dot: "bg-muted-foreground" },
  suspended: { badge: "secondary", dot: "bg-muted-foreground" },
  error: { badge: "destructive", dot: "bg-red-300" },
  unavailable: { badge: "destructive", dot: "bg-red-300" },
  pending: { badge: "outline", dot: "bg-orange-500" },
  degraded: { badge: "outline", dot: "bg-orange-500" },
};

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const config = variantConfig[variant] ?? variantConfig.pending;

  return (
    <Badge
      data-testid="status-badge"
      variant={config.badge}
      className="gap-1.5"
    >
      <span
        className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dot)}
        aria-hidden
      />
      {label ?? variant}
    </Badge>
  );
}
