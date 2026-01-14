import type { Request, Donation } from '../types';
import { createStore } from './createStore';

export type { Request, Donation };

const baseStore = createStore<Request[]>({
  key: 'dbd_donations',
  defaultValue: [],
  load: (saved) => JSON.parse(saved).map((d: any) => ({
    ...d,
    timestamp: new Date(d.timestamp),
    source: d.source || 'donation'
  }))
});

export const requestStore = {
  ...baseStore,

  add: (request: Request) => {
    baseStore.set([...baseStore.get(), request]);
  },

  update: (id: number, updates: Partial<Request>) => {
    const requests = baseStore.get();
    const idx = requests.findIndex(d => d.id === id);
    if (idx !== -1) {
      const updated = [...requests];
      updated[idx] = { ...updated[idx], ...updates };
      baseStore.set(updated);
    }
  },

  remove: (id: number) => {
    baseStore.set(baseStore.get().filter(d => d.id !== id));
  },

  clear: () => {
    baseStore.set([]);
  }
};

export const donationStore = requestStore;
