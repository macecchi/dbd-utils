import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';
import { useSources } from './sources';

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
      add: (req) => set((s) => {
        const { sortMode, priority } = useSources.getState();
        if (sortMode === 'fifo') {
          return { requests: [...s.requests, req] };
        }
        // Insert by priority: find position among pending items
        const requests = [...s.requests];
        const reqPri = priority.indexOf(req.source);
        let insertIdx = requests.length;
        for (let i = 0; i < requests.length; i++) {
          if (requests[i].done) continue;
          const iPri = priority.indexOf(requests[i].source);
          if (iPri > reqPri || (iPri === reqPri && requests[i].timestamp > req.timestamp)) {
            insertIdx = i;
            break;
          }
        }
        requests.splice(insertIdx, 0, req);
        return { requests };
      }),
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
