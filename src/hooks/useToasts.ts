import { useSyncExternalStore } from 'react';
import { toastStore } from '../store/toasts';

export function useToasts() {
  return useSyncExternalStore(toastStore.subscribe, toastStore.get);
}
