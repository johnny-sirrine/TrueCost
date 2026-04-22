import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type ToastVariant } from '../../store/toastStore';

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: 'text-emerald-600',
    text: 'text-emerald-900',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    text: 'text-red-900',
  },
  info: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: 'text-slate-600',
    text: 'text-slate-900',
  },
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const cls = VARIANT_STYLES[variant].icon;
  if (variant === 'success') return <CheckCircle2 size={16} className={cls} aria-hidden="true" />;
  if (variant === 'error') return <AlertTriangle size={16} className={cls} aria-hidden="true" />;
  return <Info size={16} className={cls} aria-hidden="true" />;
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const styles = VARIANT_STYLES[t.variant];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-3 py-2 rounded-lg shadow-md border ${styles.bg} ${styles.border} animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-xs`}
            role="status"
          >
            <VariantIcon variant={t.variant} />
            <div className={`flex-1 text-sm ${styles.text}`}>{t.message}</div>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismissToast(t.id);
                }}
                className={`text-sm font-semibold underline decoration-dotted hover:decoration-solid cursor-pointer ${styles.text}`}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              className={`${styles.icon} hover:opacity-70 cursor-pointer`}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
