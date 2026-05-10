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
      <div className="relative z-[45] w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl transform-gpu transition-transform will-change-transform animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
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
