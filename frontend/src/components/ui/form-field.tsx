import { Label } from "@/components/ui/shadcn/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Standard form field wrapper — label stacked above input with consistent spacing.
 * Use for all label + input / select combinations across the app.
 */
export function FormField({ label, htmlFor, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground leading-4 h-4 truncate block"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
