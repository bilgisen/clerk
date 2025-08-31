declare module 'sonner' {
  import { ReactNode } from 'react';

  type ToastType = 'success' | 'error' | 'info' | 'warning';

  interface ToastOptions {
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    style?: React.CSSProperties;
    className?: string;
    icon?: ReactNode;
    action?: {
      label: string;
      onClick: () => void;
    };
  }

  interface Toast {
    (message: ReactNode, options?: ToastOptions): string | number;
    success: (message: ReactNode, options?: ToastOptions) => string | number;
    error: (message: ReactNode, options?: ToastOptions) => string | number;
    info: (message: ReactNode, options?: ToastOptions) => string | number;
    warning: (message: ReactNode, options?: ToastOptions) => string | number;
    dismiss: (toastId?: string | number) => void;
    promise: <T>(promise: Promise<T>, msgs: {
      loading: ReactNode;
      success: ReactNode | ((data: T) => ReactNode);
      error: ReactNode | ((error: any) => ReactNode);
    }, opts?: ToastOptions) => Promise<T>;
  }

  const toast: Toast;
  export default toast;
}
