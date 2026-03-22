import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/shadcn/alert";
import { Button } from "@/components/ui/shadcn/button";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          data-testid="error-boundary"
          className="flex flex-col items-center justify-center py-16"
        >
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{i18n.t("common.errorOccurred")}</AlertTitle>
            <AlertDescription className="mt-1">
              {this.state.error?.message}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            {i18n.t("common.tryAgain")}
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
