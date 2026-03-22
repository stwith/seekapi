import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { useTranslation } from "react-i18next";

interface LoadingSkeletonProps {
  rows?: number;
  className?: string;
}

const widths = ["w-full", "w-3/4", "w-5/6", "w-2/3", "w-4/5"];

export function LoadingSkeleton({ rows = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({
  label,
  className,
}: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t("common.loading");
  return (
    <div
      data-testid="loading-spinner"
      className={cn(
        "flex items-center justify-center py-12 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">{displayLabel}</span>
    </div>
  );
}
