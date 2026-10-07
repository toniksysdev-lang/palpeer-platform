import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastContextValue = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'> & { id?: string }) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, 'id'> & { id?: string }) => {
      const id = toast.id ?? crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
