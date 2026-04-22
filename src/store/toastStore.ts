import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

/** Optional inline action rendered as a button inside the toast. Used for
 *  undoable operations (e.g. delete → "Undo"). The handler is responsible
 *  for any side effects; the toast auto-dismisses after click. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant, action?: ToastAction) => void;
  dismissToast: (id: string) => void;
}

const AUTO_DISMISS_MS = 3000;
// Toasts with an action live a little longer so users have time to read
// the message AND react to the action (e.g. click Undo).
const ACTION_DISMISS_MS = 6000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message, variant = 'success', action) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, action }] }));
    const dismissAfter = action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS;
    setTimeout(() => {
      get().dismissToast(id);
    }, dismissAfter);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
