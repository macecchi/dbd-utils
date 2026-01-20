// apps/web/src/store/channel.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';
import type { SourcesEnabled } from '../types';
import type { PartyMessage } from '../types/party';
import { deserializeRequest, deserializeRequests } from '../types/party';
import {
  broadcastAdd,
  broadcastUpdate,
  broadcastToggleDone,
  broadcastReorder,
  broadcastDelete,
  broadcastSetAll,
} from '../services/party';

// ============ REQUESTS STORE ============

interface RequestsStore {
  requests: Request[];
  partyConnected: boolean;
  isOwner: boolean;
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  toggleDone: (id: number) => void;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
  deleteRequest: (id: number) => void;
  setPartyConnected: (connected: boolean) => void;
  setIsOwner: (isOwner: boolean) => void;
  handlePartyMessage: (msg: PartyMessage) => void;
}

export type RequestsStoreApi = ReturnType<typeof createRequestsStore>;

export function createRequestsStore(channel: string, getSourcesState: () => SourcesStore) {
  return create<RequestsStore>()(
    persist(
      (set, get) => ({
        requests: [],
        partyConnected: false,
        isOwner: false,

        add: (req) => {
          const { partyConnected, isOwner, requests: existingRequests } = get();
          if (existingRequests.some(r => r.id === req.id)) return;

          set((s) => {
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
          });

          if (partyConnected && isOwner) {
            broadcastAdd(req);
          }
        },

        update: (id, updates) => {
          const { partyConnected, isOwner } = get();
          set((s) => ({
            requests: s.requests.map((r) => (r.id === id ? { ...r, ...updates } : r)),
          }));
          if (partyConnected && isOwner) {
            broadcastUpdate(id, updates);
          }
        },

        toggleDone: (id) => {
          const { partyConnected, isOwner } = get();
          set((s) => ({
            requests: s.requests.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
          }));
          if (partyConnected && isOwner) {
            broadcastToggleDone(id);
          }
        },

        setAll: (requests) => {
          const { partyConnected, isOwner } = get();
          set({ requests });
          if (partyConnected && isOwner) {
            broadcastSetAll(requests);
          }
        },

        reorder: (fromId, toId) => {
          const { partyConnected, isOwner } = get();
          set((s) => {
            const requests = [...s.requests];
            const fromIdx = requests.findIndex(r => r.id === fromId);
            const toIdx = requests.findIndex(r => r.id === toId);
            if (fromIdx === -1 || toIdx === -1) return s;
            const [moved] = requests.splice(fromIdx, 1);
            requests.splice(toIdx, 0, moved);
            return { requests };
          });
          if (partyConnected && isOwner) {
            broadcastReorder(fromId, toId);
          }
        },

        deleteRequest: (id) => {
          const { partyConnected, isOwner } = get();
          set((s) => ({
            requests: s.requests.filter((r) => r.id !== id),
          }));
          if (partyConnected && isOwner) {
            broadcastDelete(id);
          }
        },

        setPartyConnected: (connected) => set({ partyConnected: connected }),
        setIsOwner: (isOwner) => set({ isOwner }),

        handlePartyMessage: (msg) => {
          switch (msg.type) {
            case 'sync-full':
              set({ requests: deserializeRequests(msg.requests) });
              break;
            case 'add-request': {
              const req = deserializeRequest(msg.request);
              set((s) => {
                if (s.requests.some(r => r.id === req.id)) return s;
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
              });
              break;
            }
            case 'update-request':
              set((s) => ({
                requests: s.requests.map((r) =>
                  r.id === msg.id
                    ? { ...r, ...msg.updates, timestamp: msg.updates.timestamp ? new Date(msg.updates.timestamp) : r.timestamp }
                    : r
                ),
              }));
              break;
            case 'toggle-done':
              set((s) => ({
                requests: s.requests.map((r) => (r.id === msg.id ? { ...r, done: !r.done } : r)),
              }));
              break;
            case 'reorder':
              set((s) => {
                const requests = [...s.requests];
                const fromIdx = requests.findIndex(r => r.id === msg.fromId);
                const toIdx = requests.findIndex(r => r.id === msg.toId);
                if (fromIdx === -1 || toIdx === -1) return s;
                const [moved] = requests.splice(fromIdx, 1);
                requests.splice(toIdx, 0, moved);
                return { requests };
              });
              break;
            case 'delete-request':
              set((s) => ({
                requests: s.requests.filter((r) => r.id !== msg.id),
              }));
              break;
            case 'set-all':
              set({ requests: deserializeRequests(msg.requests) });
              break;
          }
        },
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
