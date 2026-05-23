// apps/web/src/store/channel.ts
import { create } from 'zustand';
import { MAX_PENDING_REQUESTS, DEFAULT_EXTRAS_CONFIG } from '@dbd-utils/shared';
import type { RoomExtras } from '@dbd-utils/shared';
import type { ConnectionState, Request, SourcesEnabled, PartyMessage, ChannelStatus } from '../types';
import { deserializeRequest, deserializeRequests } from '../types';
import { loadCachedQueue, saveCachedQueue } from './queueCache';
import { insertRequest, moveRequest, setRequestDone } from '../utils/requests';
import { toast } from 'sonner';
import { t } from '../i18n';
import {
  broadcastAdd,
  broadcastUpdate,
  broadcastToggleDone,
  broadcastReorder,
  broadcastDelete,
  broadcastSetAll,
  broadcastSources,
  broadcastIrcStatus,
} from '../services/party';

// ============ REQUESTS STORE ============

function requireParty(getContext: () => { partyConnected: boolean }): boolean {
  if (getContext().partyConnected) return true;
  toast.error(t('toast.error'), { description: t('toast.noConnection') });
  return false;
}

interface RequestsStore {
  requests: Request[];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  toggleDone: (id: number) => void;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
  deleteRequest: (id: number) => void;
  handlePartyMessage: (msg: PartyMessage) => void;
}

export type RequestsStoreApi = ReturnType<typeof createRequestsStore>;

export function createRequestsStore(
  channel: string,
  getSourcesState: () => SourcesStore,
  getContext: () => { partyConnected: boolean }
) {
  // Optimistic reorders awaiting their server echo. The server echoes a reorder to
  // every client and a positional move isn't idempotent, so we skip the matching
  // echo (FIFO order) to avoid double-moving. Cleared on sync-full/set-all.
  const pendingReorders: { fromId: number; toId: number }[] = [];

  const useRequests = create<RequestsStore>()(
      (set, get) => ({
        // Hydrate from the local cache so the queue paints instantly on reload,
        // before the PartyKit WebSocket delivers sync-full (which then replaces it).
        requests: loadCachedQueue(channel),

        add: (req) => {
          if (!requireParty(getContext)) return;
          // Optimistic: insert locally now, broadcast next. The server echoes
          // add-request back, but the echo dedupes by id (no-op for us).
          const { sortMode, priority } = getSourcesState();
          set((s) => ({ requests: insertRequest(s.requests, req, sortMode, priority) }));
          broadcastAdd(req);
        },

        update: (id, updates) => {
          if (!requireParty(getContext)) return;
          broadcastUpdate(id, updates);
        },

        toggleDone: (id) => {
          if (!requireParty(getContext)) return;
          const req = get().requests.find(r => r.id === id);
          if (!req) return;
          const done = !req.done;
          // Optimistic: flip locally now; the toggle-done echo is idempotent.
          set((s) => ({ requests: setRequestDone(s.requests, id, done) }));
          broadcastToggleDone(id, done);
        },

        setAll: (requests) => {
          if (!requireParty(getContext)) return;
          broadcastSetAll(requests);
        },

        reorder: (fromId, toId) => {
          if (!requireParty(getContext)) return;
          // Optimistic: move locally now and remember it so the server echo of
          // this same reorder is skipped (it would otherwise double-move).
          const current = get().requests;
          const next = moveRequest(current, fromId, toId);
          if (next !== current) {
            set({ requests: next });
            pendingReorders.push({ fromId, toId });
          }
          broadcastReorder(fromId, toId);
        },

        deleteRequest: (id) => {
          if (!requireParty(getContext)) return;
          broadcastDelete(id);
        },

        handlePartyMessage: (msg) => {
          switch (msg.type) {
            case 'sync-full': {
              // Authoritative full replace — ordering is reset, so drop any
              // pending optimistic reorders awaiting an echo.
              pendingReorders.length = 0;
              set({ requests: deserializeRequests(msg.requests) });
              break;
            }
            case 'add-request': {
              const req = deserializeRequest(msg.request);
              const { sortMode, priority } = getSourcesState();
              // insertRequest dedupes by id, so our own optimistic add is a no-op
              // here (returns the same array → no re-render).
              set((s) => {
                const requests = insertRequest(s.requests, req, sortMode, priority);
                return requests === s.requests ? s : { requests };
              });
              break;
            }
            case 'update-request': {
              const { timestamp, doneAt, ...rest } = msg.updates;
              set((s) => ({
                requests: s.requests.map((r) => {
                  if (r.id !== msg.id) return r;
                  return {
                    ...r,
                    ...rest,
                    timestamp: 'timestamp' in msg.updates
                      ? (timestamp ? new Date(timestamp) : r.timestamp)
                      : r.timestamp,
                    doneAt: 'doneAt' in msg.updates
                      ? (doneAt ? new Date(doneAt) : undefined)
                      : r.doneAt,
                  };
                }),
              }));
              break;
            }
            case 'ownership-granted':
            case 'ownership-denied':
              break;
            case 'toggle-done':
              set((s) => {
                // Idempotent: if already in the target state (our own optimistic
                // toggle, echoed back), do nothing. Others' toggles still apply.
                const existing = s.requests.find((r) => r.id === msg.id);
                if (!existing || existing.done === msg.done) return s;
                return {
                  requests: setRequestDone(s.requests, msg.id, msg.done, msg.doneAt ? new Date(msg.doneAt) : undefined),
                };
              });
              break;
            case 'reorder': {
              // Skip the echo of a reorder we already applied optimistically
              // (would otherwise double-move); apply reorders from other clients.
              const pending = pendingReorders[0];
              if (pending && pending.fromId === msg.fromId && pending.toId === msg.toId) {
                pendingReorders.shift();
                break;
              }
              set((s) => {
                const requests = moveRequest(s.requests, msg.fromId, msg.toId);
                return requests === s.requests ? s : { requests };
              });
              break;
            }
            case 'delete-request':
              set((s) => ({
                requests: s.requests.filter((r) => r.id !== msg.id),
              }));
              break;
            case 'set-all':
              pendingReorders.length = 0;
              set({ requests: deserializeRequests(msg.requests) });
              break;
          }
        },
      }),
  );

  // Persist on every change so the next reload restores the latest queue. The
  // authoritative sync-full/set-all replacements get cached, so stale rows don't survive.
  useRequests.subscribe((state) => saveCachedQueue(channel, state.requests));

  return useRequests;
}

// ============ SOURCES STORE ============

export type SourceType = 'donation' | 'resub' | 'chat' | 'manual';
export type SortMode = 'priority' | 'fifo';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sortMode: SortMode;
  minDonation: number;
  hideNonRequests: boolean;
  confirmInChat: boolean;
  extrasConfig: RoomExtras;
  recoveryVodId?: string;
  recoveryVodOffset?: number;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  setSortMode: (mode: SortMode) => void;
  setMinDonation: (min: number) => void;
  setHideNonRequests: (hide: boolean) => void;
  setConfirmInChat: (confirm: boolean) => void;
  setExtrasConfig: (extrasConfig: RoomExtras) => void;
  setRecoveryCheckpoint: (vodId: string, offset: number) => void;
  handlePartyMessage: (msg: PartyMessage) => void;
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
  hideNonRequests: true,
  confirmInChat: false,
  extrasConfig: DEFAULT_EXTRAS_CONFIG,
};


export function createSourcesStore(
  channel: string,
  getContext: () => { partyConnected: boolean }
) {
  const maybeBroadcast = (get: () => SourcesStore) => {
    if (getContext().partyConnected) {
      broadcastSources(get());
    }
  };

  return create<SourcesStore>()(
      (set, get) => ({
        enabled: SOURCES_DEFAULTS.enabled,
        chatCommand: SOURCES_DEFAULTS.chatCommand,
        chatTiers: SOURCES_DEFAULTS.chatTiers,
        priority: SOURCES_DEFAULTS.priority,
        sortMode: SOURCES_DEFAULTS.sortMode,
        minDonation: SOURCES_DEFAULTS.minDonation,
        hideNonRequests: SOURCES_DEFAULTS.hideNonRequests,
        confirmInChat: SOURCES_DEFAULTS.confirmInChat,
        extrasConfig: SOURCES_DEFAULTS.extrasConfig,
        setEnabled: (enabled) => {
          set({ enabled });
          maybeBroadcast(get);
        },
        toggleSource: (source) => {
          set((s) => ({ enabled: { ...s.enabled, [source]: !s.enabled[source] } }));
          maybeBroadcast(get);
        },
        setChatCommand: (chatCommand) => {
          set({ chatCommand });
          maybeBroadcast(get);
        },
        setChatTiers: (chatTiers) => {
          set({ chatTiers });
          maybeBroadcast(get);
        },
        setPriority: (priority) => {
          set({ priority });
          maybeBroadcast(get);
        },
        setSortMode: (sortMode) => {
          set({ sortMode });
          maybeBroadcast(get);
        },
        setMinDonation: (minDonation) => {
          set({ minDonation });
          maybeBroadcast(get);
        },
        setHideNonRequests: (hideNonRequests) => {
          set({ hideNonRequests });
          maybeBroadcast(get);
        },
        setConfirmInChat: (confirmInChat) => {
          set({ confirmInChat });
          maybeBroadcast(get);
        },
        setExtrasConfig: (extrasConfig) => {
          set({ extrasConfig });
          maybeBroadcast(get);
        },
        setRecoveryCheckpoint: (recoveryVodId, recoveryVodOffset) => {
          set({ recoveryVodId, recoveryVodOffset });
          maybeBroadcast(get);
        },
        handlePartyMessage: (msg) => {
          if (msg.type === 'sync-full' || msg.type === 'update-sources') {
            const sources = msg.sources;
            // No persisted extrasConfig → use the in-memory default. We do NOT
            // broadcast it back: viewers don't have permission to write sources,
            // and the owner persists their real choice the moment they touch
            // the toggle (which goes through setExtrasConfig → broadcast).
            const extrasConfig = sources.extrasConfig ?? DEFAULT_EXTRAS_CONFIG;

            set({
              enabled: sources.enabled,
              chatCommand: sources.chatCommand,
              chatTiers: sources.chatTiers,
              priority: sources.priority,
              sortMode: sources.sortMode,
              minDonation: sources.minDonation,
              hideNonRequests: sources.hideNonRequests ?? true,
              confirmInChat: sources.confirmInChat ?? false,
              recoveryVodId: sources.recoveryVodId,
              recoveryVodOffset: sources.recoveryVodOffset,
              extrasConfig,
            });
          }
        },
      }),
  );
}

// ============ CHANNEL INFO STORE ============

interface ChannelOwner {
  login: string;
  displayName: string;
  avatar: string;
}

interface ChannelInfoStore {
  status: ChannelStatus;
  owner: ChannelOwner | null;
  hasLock: boolean;
  partySynced: boolean;
  localIrcConnectionState: ConnectionState;
  localPartyConnectionState: ConnectionState;
  setHasLock: (hasLock: boolean) => void;
  setIrcConnectionState: (state: ConnectionState, broadcast?: boolean) => void;
  setPartyConnectionState: (state: ConnectionState) => void;
  handlePartyMessage: (msg: PartyMessage) => void;
}

export type ChannelInfoStoreApi = ReturnType<typeof createChannelInfoStore>;

export function createChannelInfoStore() {
  return create<ChannelInfoStore>()((set, get) => ({
    status: 'offline',
    owner: null,
    hasLock: false,
    partySynced: false,
    localIrcConnectionState: 'disconnected',
    localPartyConnectionState: 'disconnected',
    setHasLock: (hasLock) => set({ hasLock }),
    setIrcConnectionState: (state, broadcast = true) => {
      set({ localIrcConnectionState: state });
      if (broadcast) {
        const { hasLock } = get();
        if (hasLock) {
          broadcastIrcStatus(state === 'connected');
        }
      }
    },
    setPartyConnectionState: (state) => {
      set({ localPartyConnectionState: state });
      if (state === 'disconnected') {
        set({ partySynced: false });
      }
    },
    handlePartyMessage: (msg) => {
      if (msg.type === 'sync-full') {
        set({ partySynced: true });
      }
      if (msg.type === 'ownership-granted') {
        set({ hasLock: true });
      } else if (msg.type === 'ownership-denied') {
        set({ hasLock: false });
      } else if (msg.type === 'sync-full' || msg.type === 'update-channel') {
        const updates: Partial<ChannelInfoStore> = {
          status: msg.channel.status,
          owner: msg.channel.owner,
        };
        // Reset hasLock when channel has no owner (released or disconnected)
        if (!msg.channel.owner) {
          updates.hasLock = false;
        }
        set(updates);
      }
    },
  }));
}

// ============ CHANNEL STORES ============

export interface ChannelStores {
  useRequests: RequestsStoreApi;
  useSources: SourcesStoreApi;
  useChannelInfo: ChannelInfoStoreApi;
}

// Given a room name, initialize all the stores for that room
export function createRoomStores(channel: string): ChannelStores {
  const key = channel.toLowerCase();

  // ChannelInfoStore is created first - it has no dependencies
  const useChannelInfo = createChannelInfoStore();

  const getContext = () => ({
    partyConnected: useChannelInfo.getState().localPartyConnectionState === 'connected',
  });

  let useSources: SourcesStoreApi;

  const useRequests = createRequestsStore(key, () => useSources.getState(), getContext);
  useSources = createSourcesStore(key, getContext);

  return { useRequests, useSources, useChannelInfo };
}
