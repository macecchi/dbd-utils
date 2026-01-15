import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';

interface RequestsStore {
  requests: Request[];
  deletedStack: Request[][];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  remove: (ids: number[]) => void;
  toggleDone: (id: number) => void;
  clearDone: () => number;
  undo: () => Request[] | null;
  setAll: (requests: Request[]) => void;
}

export const useRequests = create<RequestsStore>()(
  persist(
    (set, get) => ({
      requests: [],
      deletedStack: [],
      add: (req) => set((s) => ({ requests: [...s.requests, req] })),
      update: (id, updates) => set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, ...updates } : r)),
      })),
      remove: (ids) => {
        const { requests } = get();
        const removed = requests.filter((r) => ids.includes(r.id));
        if (removed.length === 0) return;
        set((s) => ({
          requests: s.requests.filter((r) => !ids.includes(r.id)),
          deletedStack: [...s.deletedStack, removed],
        }));
      },
      toggleDone: (id) => set((s) => ({
        requests: s.requests.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
      })),
      clearDone: () => {
        const { requests } = get();
        const done = requests.filter((r) => r.done);
        if (done.length === 0) return 0;
        set((s) => ({
          requests: s.requests.filter((r) => !r.done),
          deletedStack: [...s.deletedStack, done],
        }));
        return done.length;
      },
      undo: () => {
        const { deletedStack } = get();
        if (deletedStack.length === 0) return null;
        const last = deletedStack[deletedStack.length - 1];
        set((s) => ({
          requests: [...s.requests, ...last],
          deletedStack: s.deletedStack.slice(0, -1),
        }));
        return last;
      },
      setAll: (requests) => set({ requests }),
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
