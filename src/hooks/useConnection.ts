import { useSyncExternalStore } from 'react';
import { connectionStore } from '../store/connection';

export function useConnection() {
  return useSyncExternalStore(connectionStore.subscribe, connectionStore.getSnapshot);
}
