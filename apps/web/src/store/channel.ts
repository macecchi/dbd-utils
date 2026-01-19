// apps/web/src/store/channel.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';
import type { SourcesEnabled } from '../types';

// ============ REQUESTS STORE ============

interface RequestsStore {
  requests: Request[];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  toggleDone: (id: number) => void;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
}

export type RequestsStoreApi = ReturnType<typeof createRequestsStore>;

export function createRequestsStore(channel: string, getSourcesState: () => SourcesStore) {
  return create<RequestsStore>()(
    persist(
      (set) => ({
        requests: [],
        add: (req) => set((s) => {
          const { sortMode, priority } = getSourcesState();
          if (sortMode === 'fifo') {
            return { requests: [...s.requests, req] };
          }
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
        name: `dbd-requests-${channel}`,
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
}

// ============ SOURCES STORE ============

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';
type SortMode = 'priority' | 'fifo';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sortMode: SortMode;
  minDonation: number;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  setSortMode: (mode: SortMode) => void;
  setMinDonation: (min: number) => void;
}

export type SourcesStoreApi = ReturnType<typeof createSourcesStore>;

export const SOURCES_DEFAULTS = {
  enabled: {
    donation: true,
    chat: true,
    resub: false,
    manual: true,
  },
  chatCommand: '!fila',
  chatTiers: [2, 3],
  priority: ['donation', 'chat', 'resub', 'manual'] as SourceType[],
  sortMode: 'fifo' as SortMode,
  minDonation: 5,
};

export function createSourcesStore(channel: string) {
  return create<SourcesStore>()(
    persist(
      (set) => ({
        enabled: SOURCES_DEFAULTS.enabled,
        chatCommand: SOURCES_DEFAULTS.chatCommand,
        chatTiers: SOURCES_DEFAULTS.chatTiers,
        priority: SOURCES_DEFAULTS.priority,
        sortMode: SOURCES_DEFAULTS.sortMode,
        minDonation: SOURCES_DEFAULTS.minDonation,
        setEnabled: (enabled) => set({ enabled }),
        toggleSource: (source) => set((s) => ({
          enabled: { ...s.enabled, [source]: !s.enabled[source] }
        })),
        setChatCommand: (chatCommand) => set({ chatCommand }),
        setChatTiers: (chatTiers) => set({ chatTiers }),
        setPriority: (priority) => set({ priority }),
        setSortMode: (sortMode) => set({ sortMode }),
        setMinDonation: (minDonation) => set({ minDonation }),
      }),
      { name: `dbd-sources-${channel}` }
    )
  );
}

// ============ CHANNEL STORES ============

export interface ChannelStores {
  useRequests: RequestsStoreApi;
  useSources: SourcesStoreApi;
}

export function createChannelStores(channel: string): ChannelStores {
  const key = channel.toLowerCase();
  const useSources = createSourcesStore(key);
  const useRequests = createRequestsStore(key, () => useSources.getState());
  return { useRequests, useSources };
}
