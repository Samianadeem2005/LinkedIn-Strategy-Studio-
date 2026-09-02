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

  const isAccent = type === 'error' || type === 'warning';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 animate-fade-in max-w-sm px-4 py-3 rounded-2xl border text-xs font-semibold shadow-[0_8px_30px_rgba(44,44,44,0.08)] transition-all duration-200 ${
        isAccent
          ? 'bg-white border-[#c94731]/40 text-[#c94731]'
          : 'bg-white border-[#4f6e7d]/30 text-[#2c2c2c]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex-1 leading-normal">{message}</span>
        <button
          onClick={onClose}
          className="w-5 h-5 rounded-full flex items-center justify-center text-sm leading-none text-[#4f6e7d] hover:text-[#2c2c2c] hover:bg-[#4f6e7d]/10 transition-colors p-1 cursor-pointer"
        >
          ×
        </button>
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
