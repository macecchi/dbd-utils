import { useSyncExternalStore } from 'react';
import { donationStore } from '../store/donations';

export function useDonations() {
  return useSyncExternalStore(donationStore.subscribe, donationStore.get);
}
