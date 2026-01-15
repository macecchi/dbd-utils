import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';

interface RequestsStore {
  requests: Request[];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  toggleDone: (id: number) => void;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
}

export const useRequests = create<RequestsStore>()(
  persist(
    (set) => ({
      requests: [],
      add: (req) => set((s) => ({ requests: [...s.requests, req] })),
      update: (id, updates) => set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      })),
      toggleDone: (id) => set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
      })),
      setAll: (requests) => set({ requests }),
      reorder: (fromId, toId) => set((s) => {
        const requests = [...s.requests];
        const fromIdx = requests.findIndex(r => r.id === fromId);
        const toIdx = requests.findIndex(r => r.id === toId);
        if (fromIdx === -1 || toIdx === -1) return s;
        const [moved] = requests.splice(fromIdx, 1);
        requests.splice(toIdx, 0, moved);
        return { requests };
      }),
    }),
    {
      name: 'dbd-requests',
      partialize: (state) => ({ requests: state.requests }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            state: {
              ...parsed.state,
              requests: (parsed.state.requests || []).map((r: any) => ({
                ...r,
                timestamp: new Date(r.timestamp),
              })),
            },
          };
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
