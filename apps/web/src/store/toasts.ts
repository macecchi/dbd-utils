import { create } from 'zustand';
import type { Toast } from '../types';

interface ToastsStore {
  toasts: Toast[];
  nextId: number;
  add: (toast: Omit<Toast, 'id'>) => number;
  remove: (id: number) => void;
  show: (msg: string, title?: string, color?: string, duration?: number) => void;
  showUndo: (message: string, undoCallback: () => void) => void;
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
  show: (message, title, color, duration = 5000) => {
    get().add({ message, title, color, duration, type: 'default' });
  },
  showUndo: (message, undoCallback) => {
    get().add({ message, duration: 5000, type: 'undo', undoCallback });
  },
}));
