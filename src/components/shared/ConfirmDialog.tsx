import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'neutral';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Close on escape, focus confirm button on open
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKey, true);
    // Focus the cancel side by default for dangerous actions to reduce accidental enter-confirms
    if (variant !== 'danger') {
      confirmButtonRef.current?.focus();
    }
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [open, onCancel, variant]);

  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
    },
    warning: {
      icon: 'text-amber-500',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white',
    },
    neutral: {
      icon: 'text-blue-500',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-5 animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
              {title}
            </h3>
            <p id="confirm-dialog-message" className="mt-1.5 text-sm text-slate-600">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
