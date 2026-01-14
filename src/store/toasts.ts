import type { Toast } from '../types';
import { createMemoryStore } from './createStore';

export type { Toast };

let nextId = 1;

const baseStore = createMemoryStore<Toast[]>({ defaultValue: [] });

export const toastStore = {
  ...baseStore,

  add: (toast: Omit<Toast, 'id'>) => {
    const id = nextId++;
    const newToast = { ...toast, id };
    baseStore.set([...baseStore.get(), newToast]);

    if (toast.duration > 0) {
      setTimeout(() => toastStore.remove(id), toast.duration);
    }
    return id;
  },

  remove: (id: number) => {
    baseStore.set(baseStore.get().filter(t => t.id !== id));
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
