import { useSyncExternalStore } from 'react';
import { sourcesStore } from '../store/sources';

export function useSources() {
  return useSyncExternalStore(sourcesStore.subscribe, sourcesStore.get);
}
