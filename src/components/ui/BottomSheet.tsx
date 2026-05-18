import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[40] flex items-end justify-center sm:items-center pb-16 sm:pb-0">
      {/* Backdrop - Only covers area above menu */}
      <div
        className="fixed inset-0 bg-zinc-900/45 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative z-[45] w-full max-w-md rounded-t-3xl bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl transform-gpu transition-transform will-change-transform animate-in slide-in-from-bottom duration-300 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button 
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Scrollable content area */}
        <div className="max-h-[75vh] overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
