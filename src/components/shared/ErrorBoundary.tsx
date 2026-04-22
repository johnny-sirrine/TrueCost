import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-md border border-slate-200 p-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-red-500">
                <AlertTriangle size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
                <p className="mt-1 text-sm text-slate-600">
                  The app hit an unexpected error. Your data is saved locally and should be intact.
                </p>
                {this.state.error.message && (
                  <pre className="mt-3 p-2 text-xs text-slate-600 bg-slate-50 rounded border border-slate-200 overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.error.message}
                  </pre>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={this.handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer"
                  >
                    <RotateCcw size={14} />
                    Try again
                  </button>
                  <button
                    onClick={this.handleReload}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    Reload app
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
