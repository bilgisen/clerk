'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call the error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Log to your error tracking service
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, { 
        extra: { 
          componentStack: errorInfo?.componentStack,
          errorInfo: errorInfo ? {
            componentStack: errorInfo.componentStack,
          } : undefined
        } 
      });
    }

    this.setState({ 
      error, 
      errorInfo: errorInfo || null 
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || this.renderDefaultErrorUI();
    }

    return this.props.children;
  }

  private renderDefaultErrorUI() {
    return (
      <div className="p-6 max-w-2xl mx-auto my-8 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold text-red-800 mb-4">Something went wrong.</h2>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <div className="mb-4 p-3 bg-red-100 rounded overflow-auto">
            <pre className="text-xs text-red-800">
              {this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>
        )}
        <Button
          onClick={() => {
            window.location.reload();
          }}
          variant="destructive"
        >
          Reload Page
        </Button>
      </div>
    );
  }
}

export function withErrorBoundary<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) {
  return function WithErrorBoundary(props: T) {
    return (
      <ErrorBoundary {...(errorBoundaryProps || {})}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
