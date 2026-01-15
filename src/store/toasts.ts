import { create } from 'zustand';
import type { Toast } from '../types';

interface ToastsStore {
  toasts: Toast[];
  nextId: number;
  add: (toast: Omit<Toast, 'id'>) => number;
  remove: (id: number) => void;
  clearUndo: () => void;
  show: (msg: string, title?: string, color?: string, duration?: number) => void;
  showUndo: (count: number, undoCallback: () => void) => void;
}

export const useToasts = create<ToastsStore>((set, get) => ({
  toasts: [],
  nextId: 1,
  add: (toast) => {
    const id = get().nextId;
    set((s) => ({
      toasts: [...s.toasts, { ...toast, id }],
      nextId: s.nextId + 1,
    }));
    if (toast.duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), toast.duration);
    }
    return id;
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearUndo: () => set((s) => ({ toasts: s.toasts.filter((t) => t.type !== 'undo') })),
  show: (message, title, color, duration = 5000) => {
    get().add({ message, title, color, duration, type: 'default' });
  },
  showUndo: (count, undoCallback) => {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
    const hint = isMac ? '⌘Z' : 'Ctrl+Z';
    const msg = count > 1 ? `${count} excluídos` : 'Excluído';
    get().add({ message: msg, duration: 5000, type: 'undo', undoCallback, undoHint: hint });
  },
}));
