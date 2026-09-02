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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden backdrop-blur-sm animate-fade-in"
      style={{ background: 'rgba(28,28,30,0.38)' }}>
      <div
        className={`w-full ${width} rounded-3xl bg-white text-[#1C1C1E] animate-panel-settle overflow-hidden`}
        style={{
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          border: '1px solid rgba(167,139,224,0.20)',
          boxShadow: '0 24px 64px rgba(100,80,160,0.14)'
        }}
      >
        {/* Pinned Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(167,139,224,0.14)', background: '#F6F5F8' }}>
          <h2 className="font-bold text-base tracking-tight" style={{ color: '#1C1C1E' }}>{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer"
            style={{ border: '1px solid rgba(167,139,224,0.22)', color: '#8B8A93', background: '#FFFFFF' }}
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
          <div className="px-6 py-4 flex items-center justify-end gap-2 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(167,139,224,0.14)', background: '#F6F5F8' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
