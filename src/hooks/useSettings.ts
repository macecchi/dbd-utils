import { useSyncExternalStore } from 'react';
import { settingsStore } from '../store/settings';

export function useSettings() {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
}
