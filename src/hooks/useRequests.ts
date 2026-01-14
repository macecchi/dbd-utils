import { useSyncExternalStore } from 'react';
import { requestStore } from '../store/requests';

export function useRequests() {
  return useSyncExternalStore(requestStore.subscribe, requestStore.get);
}

export const useDonations = useRequests;
