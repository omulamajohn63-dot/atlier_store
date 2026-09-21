import React from 'react';
import { audit } from '../lib/logger';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    void audit(
      'security_event',
      'Uncaught storefront render error.',
      { source: 'error_boundary' },
      {
        message: sanitizeText(error.message),
        stack: sanitizeText(error.stack || '', 2000),
        componentStack: sanitizeText(info.componentStack || '', 2000),
      }
    );
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] px-4">
          <div className="w-full max-w-md text-center space-y-5 mt-[-8vh]">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#FDF2F2] border border-[#F8B4B4] flex items-center justify-center text-[#9B1C1C]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h1 className="font-serif text-2xl text-[#181716]">Something went wrong</h1>
              <p className="text-sm text-[#63605A] leading-relaxed">
                We've tracked this error and the modeza team has been notified. Your cart and
                saved details are safe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#181716] text-[#FAF9F6] text-xs font-semibold uppercase tracking-wider hover:bg-[#2B2A28] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function sanitizeText(value: string | null | undefined, maxLength = 1000): string {
  if (!value) return '';
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}