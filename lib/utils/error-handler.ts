// Client-side error handling utilities

interface ErrorContext {
  componentStack?: string | null;
  componentName?: string;
  userInfo?: Record<string, any>;
  timestamp?: string;
  pathname?: string;
  [key: string]: any; // Allow additional properties
}

export function logError(error: Error, context: ErrorContext = {}) {
  const errorInfo = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString(),
    pathname: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Application Error:', errorInfo);
  }

  // Send to your error tracking service (e.g., Sentry, LogRocket)
  if (typeof window !== 'undefined') {
    // Example: Send to your API endpoint
    try {
      fetch('/api/log-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorInfo),
      }).catch(console.error);
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  }
}

// Global error handler for uncaught exceptions
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), {
      componentStack: event.error?.componentStack,
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    logError(error instanceof Error ? error : new Error(String(error)));
  });
}

import React from 'react';

interface WithErrorLoggingProps {
  componentName: string;
}

export function withErrorLogging<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  const WithErrorLogging: React.FC<P> = (props) => {
    try {
      return React.createElement(WrappedComponent, { ...props } as P);
    } catch (error) {
      logError(error as Error, {
        componentName: componentName,
      });
      throw error;
    }
  };
  
  WithErrorLogging.displayName = `withErrorLogging(${componentName})`;
  return WithErrorLogging;
}
