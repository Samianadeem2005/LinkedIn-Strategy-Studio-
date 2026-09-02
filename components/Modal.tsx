'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function Modal({ title, onClose, children, footer, width = 'max-w-lg' }: ModalProps) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden bg-[#2c2c2c]/40 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full ${width} rounded-3xl border border-[#4f6e7d]/20 bg-[#ffffff] text-[#2c2c2c] shadow-2xl animate-panel-settle overflow-hidden`}
        style={{
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        {/* Pinned Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#4f6e7d]/15 bg-[#f5f1f2] flex-shrink-0">
          <h2 className="font-bold text-base text-[#2c2c2c] tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full border border-[#4f6e7d]/20 text-[#4f6e7d] hover:text-white hover:bg-[#4f6e7d] hover:border-[#4f6e7d] transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 text-sm flex-1 overflow-y-auto min-h-0">
          {children}
        </div>

        {/* Pinned Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-[#4f6e7d]/15 bg-[#f5f1f2] flex items-center justify-end gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
