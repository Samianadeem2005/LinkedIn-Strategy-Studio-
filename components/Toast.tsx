'use client';

import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    success: { bg: '#0d2e22', border: '#22d3a8', text: '#22d3a8' },
    error: { bg: '#2e0d0d', border: '#ef4444', text: '#ef4444' },
    warning: { bg: '#2e200d', border: '#f59e0b', text: '#f59e0b' },
    info: { bg: '#0d1a2e', border: '#6c63ff', text: '#6c63ff' },
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in max-w-sm px-4 py-3 rounded-lg border text-sm font-medium"
      style={{ background: colors.bg, borderColor: colors.border, color: colors.text, boxShadow: `0 4px 24px ${colors.border}33` }}>
      <div className="flex items-start gap-2">
        <span className="flex-1">{message}</span>
        <button onClick={onClose} className="text-lg leading-none opacity-60 hover:opacity-100 ml-2">×</button>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; type: ToastProps['type'] } | null>(null);
  const show = React.useCallback((message: string, type: ToastProps['type'] = 'info') => setToast({ message, type }), []);
  const hide = React.useCallback(() => setToast(null), []);
  const ToastEl = toast ? <Toast message={toast.message} type={toast.type} onClose={hide} /> : null;
  return { show, ToastEl };
}
