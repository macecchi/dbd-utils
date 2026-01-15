import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';

interface DeletedItem {
  request: Request;
  index: number;
}

interface RequestsStore {
  requests: Request[];
  deletedStack: DeletedItem[][];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  remove: (ids: number[]) => void;
  toggleDone: (id: number) => void;
  clearDone: () => number;
  undo: () => Request[] | null;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
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
        const removed: DeletedItem[] = [];
        requests.forEach((r, idx) => {
          if (ids.includes(r.id)) {
            removed.push({ request: r, index: idx });
          }
        });
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
        const removed: DeletedItem[] = [];
        requests.forEach((r, idx) => {
          if (r.done) {
            removed.push({ request: r, index: idx });
          }
        });
        if (removed.length === 0) return 0;
        set((s) => ({
          requests: s.requests.filter((r) => !r.done),
          deletedStack: [...s.deletedStack, removed],
        }));
        return removed.length;
      },
      undo: () => {
        const { deletedStack, requests } = get();
        if (deletedStack.length === 0) return null;
        const last = deletedStack[deletedStack.length - 1];
        const newRequests = [...requests];
        // restore in order of original indices so positions stay correct
        const sorted = [...last].sort((a, b) => a.index - b.index);
        for (const item of sorted) {
          const idx = Math.min(item.index, newRequests.length);
          newRequests.splice(idx, 0, item.request);
        }
        set({
          requests: newRequests,
          deletedStack: deletedStack.slice(0, -1),
        });
        return last.map((d) => d.request);
      },
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
