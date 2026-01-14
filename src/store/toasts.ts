export interface Toast {
  id: number;
  message: string;
  title?: string;
  color?: string;
  duration: number;
  type: 'default' | 'info' | 'undo';
  undoCallback?: () => void;
  undoHint?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(fn => fn());
}

export const toastStore = {
  get: () => toasts,

  add: (toast: Omit<Toast, 'id'>) => {
    const id = nextId++;
    const newToast = { ...toast, id };
    toasts = [...toasts, newToast];
    notify();

    if (toast.duration > 0) {
      setTimeout(() => toastStore.remove(id), toast.duration);
    }
    return id;
  },

  remove: (id: number) => {
    toasts = toasts.filter(t => t.id !== id);
    notify();
  },

  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};

export function showToast(msg: string, title?: string, color?: string, duration = 5000) {
  toastStore.add({ message: msg, title, color, duration, type: 'default' });
}

export function showToastInfo(msg: string, duration = 3000) {
  toastStore.add({ message: msg, duration, type: 'info' });
}

export function showUndoToast(count: number, undoCallback: () => void) {
  const isMac = navigator.platform.includes('Mac');
  const hint = isMac ? '⌘Z' : 'Ctrl+Z';
  const msg = count > 1 ? `${count} excluídos` : 'Excluído';
  toastStore.add({ message: msg, duration: 5000, type: 'undo', undoCallback, undoHint: hint });
}

// Expose to vanilla JS
(window as any).showToast = showToast;
(window as any).showToastInfo = showToastInfo;
(window as any).showUndoToast = showUndoToast;
(window as any).toastStore = toastStore;
