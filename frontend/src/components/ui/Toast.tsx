import { useEffect } from "react";

interface ToastProps {
  message: string;
  variant?: "success" | "error" | "info";
  onDismiss: () => void;
  durationMs?: number;
}

const variantClass: Record<string, string> = {
  success: "bg-green-900/80 border-green-700 text-green-300",
  error: "bg-red-900/80 border-red-700 text-red-300",
  info: "bg-gray-800/80 border-gray-600 text-gray-300",
};

export function Toast({ message, variant = "info", onDismiss, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      data-testid="toast"
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg border text-sm shadow-lg ${variantClass[variant]}`}
    >
      {message}
    </div>
  );
}
