type BadgeVariant = "active" | "disabled" | "error" | "pending" | "healthy" | "degraded" | "unavailable" | "suspended";

const variantClass: Record<BadgeVariant, string> = {
  active: "bg-green-900/50 text-green-400 border-green-700",
  healthy: "bg-green-900/50 text-green-400 border-green-700",
  disabled: "bg-gray-800 text-gray-400 border-gray-600",
  suspended: "bg-gray-800 text-gray-400 border-gray-600",
  error: "bg-red-900/50 text-red-400 border-red-700",
  unavailable: "bg-red-900/50 text-red-400 border-red-700",
  pending: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
  degraded: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantClass[variant] ?? variantClass.pending}`}
    >
      {label ?? variant}
    </span>
  );
}
