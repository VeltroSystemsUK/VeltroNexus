import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  componentDidMount() {
    window.setTimeout(() => sessionStorage.removeItem("eb-reload"), 4000);
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-3">
            <h1 className="text-lg font-semibold">This page hit an error</h1>
            <p className="text-sm text-muted-foreground">Reload and try again. If it keeps happening, open the page from the prospect record.</p>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
