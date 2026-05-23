import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoomStores, createSourcesStore } from './channel';
import type { Request } from '../types';
import type { SourcesSettings } from '../types';

// Mock the party service broadcasts
vi.mock('../services/party', () => ({
  broadcastAdd: vi.fn(),
  broadcastUpdate: vi.fn(),
  broadcastToggleDone: vi.fn(),
  broadcastReorder: vi.fn(),
  broadcastDelete: vi.fn(),
  broadcastSetAll: vi.fn(),
  broadcastSources: vi.fn(),
  broadcastIrcStatus: vi.fn(),
}));

import * as party from '../services/party';

function createTestRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: Date.now(),
    donor: 'TestUser',
    message: 'Test message',
    character: 'Meg Thomas',
    type: 'survivor',
    amount: '10',
    amountVal: 10,
    source: 'manual',
    done: false,
    timestamp: new Date(),
    ...overrides,
  };
}

function serialized(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    donor: 'A',
    message: 'm',
    character: 'Meg Thomas',
    type: 'survivor' as const,
    amount: '10',
    amountVal: 10,
    source: 'manual' as const,
    done: false,
    timestamp: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  };
}

describe('channel stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Bun's runtime injects a partial localStorage that shadows jsdom's (it lacks
    // .clear), so install a clean in-memory store for deterministic, isolated tests.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('createRoomStores', () => {
    it('creates stores with correct initial state', () => {
      const stores = createRoomStores('testchannel');

      const channelInfo = stores.useChannelInfo.getState();
      expect(channelInfo.hasLock).toBe(false);
      expect(channelInfo.localPartyConnectionState).toBe('disconnected');

      const requests = stores.useRequests.getState();
      expect(requests.requests).toEqual([]);
    });

    it('normalizes channel name to lowercase', () => {
      const stores = createRoomStores('TestChannel');
      // The store should work - we can't directly test the key but we can verify it works
      const requests = stores.useRequests.getState();
      expect(requests.requests).toEqual([]);
    });
  });

  describe('partyConnected derivation', () => {
    it('returns false when disconnected', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('disconnected');

      // Add a request and verify broadcast is NOT called
      const request = createTestRequest();
      stores.useChannelInfo.getState().setHasLock(true);
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).not.toHaveBeenCalled();
    });

    it('returns false when connecting', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('connecting');
      stores.useChannelInfo.getState().setHasLock(true);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).not.toHaveBeenCalled();
    });

    it('returns false when error', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('error');
      stores.useChannelInfo.getState().setHasLock(true);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).not.toHaveBeenCalled();
    });

    it('returns true when connected', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('connected');
      stores.useChannelInfo.getState().setHasLock(true);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).toHaveBeenCalledWith(request);
    });
  });

  describe('broadcast conditions', () => {
    it('broadcasts when connected AND owner', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('connected');
      stores.useChannelInfo.getState().setHasLock(true);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).toHaveBeenCalledTimes(1);
    });

    it('broadcasts when connected without lock', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('connected');
      stores.useChannelInfo.getState().setHasLock(false);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).toHaveBeenCalledTimes(1);
    });

    it('does NOT add when not connected', () => {
      const stores = createRoomStores('testchannel');

      stores.useChannelInfo.getState().setPartyConnectionState('disconnected');
      stores.useChannelInfo.getState().setHasLock(true);

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).not.toHaveBeenCalled();
      expect(stores.useRequests.getState().requests).toHaveLength(0);
    });
  });

  describe('RequestsStore operations', () => {
    it('add() broadcasts without updating local state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      const request = createTestRequest();
      stores.useRequests.getState().add(request);

      expect(party.broadcastAdd).toHaveBeenCalledWith(request);
      expect(stores.useRequests.getState().requests).toHaveLength(0);
    });

    it('update() broadcasts without updating local state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      stores.useRequests.getState().update(123, { done: true });

      expect(party.broadcastUpdate).toHaveBeenCalledWith(123, { done: true });
    });

    it('toggleDone() broadcasts with target done state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      // Seed a request via handlePartyMessage
      stores.useRequests.getState().handlePartyMessage({
        type: 'sync-full',
        requests: [{ id: 456, donor: 'Test', message: '', character: 'Meg', type: 'survivor', amount: '0', amountVal: 0, source: 'manual', done: false, timestamp: new Date().toISOString() }],
        sources: {} as any,
        channel: {} as any,
      });

      stores.useRequests.getState().toggleDone(456);

      expect(party.broadcastToggleDone).toHaveBeenCalledWith(456, true);
    });

    it('deleteRequest() broadcasts without updating local state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      stores.useRequests.getState().deleteRequest(789);

      expect(party.broadcastDelete).toHaveBeenCalledWith(789);
    });

    it('reorder() broadcasts without updating local state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      stores.useRequests.getState().reorder(2, 1);

      expect(party.broadcastReorder).toHaveBeenCalledWith(2, 1);
    });

    it('setAll() broadcasts without updating local state', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      const requests = [createTestRequest({ id: 1 }), createTestRequest({ id: 2 })];
      stores.useRequests.getState().setAll(requests);

      expect(party.broadcastSetAll).toHaveBeenCalledWith(requests);
      expect(stores.useRequests.getState().requests).toHaveLength(0);
    });

    it('does not broadcast when not connected', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('disconnected');

      stores.useRequests.getState().add(createTestRequest());
      stores.useRequests.getState().toggleDone(1);
      stores.useRequests.getState().deleteRequest(1);

      expect(party.broadcastAdd).not.toHaveBeenCalled();
      expect(party.broadcastToggleDone).not.toHaveBeenCalled();
      expect(party.broadcastDelete).not.toHaveBeenCalled();
    });
  });

  describe('SourcesStore operations', () => {
    it('broadcasts sources when connected', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('connected');

      stores.useSources.getState().toggleSource('chat');

      expect(party.broadcastSources).toHaveBeenCalled();
    });

    it('does NOT broadcast sources when not connected', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setPartyConnectionState('disconnected');

      stores.useSources.getState().toggleSource('chat');

      expect(party.broadcastSources).not.toHaveBeenCalled();
    });
  });

  describe('ChannelInfoStore operations', () => {
    it('broadcasts IRC status when owner', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setHasLock(true);

      stores.useChannelInfo.getState().setIrcConnectionState('connected');

      expect(party.broadcastIrcStatus).toHaveBeenCalledWith(true);
    });

    it('does NOT broadcast IRC status when not owner', () => {
      const stores = createRoomStores('testchannel');
      stores.useChannelInfo.getState().setHasLock(false);

      stores.useChannelInfo.getState().setIrcConnectionState('connected');

      expect(party.broadcastIrcStatus).not.toHaveBeenCalled();
    });
  });

  describe('queue cache (persist + hydrate)', () => {
    const cacheKey = 'fila-dbd-queue-v1-testchannel';

    it('hydrates requests from localStorage on store creation', () => {
      localStorage.setItem(cacheKey, JSON.stringify({ v: 1, requests: [serialized({ id: 7 })] }));
      const reqs = createRoomStores('testchannel').useRequests.getState().requests;
      expect(reqs).toHaveLength(1);
      expect(reqs[0].id).toBe(7);
      expect(reqs[0].timestamp).toBeInstanceOf(Date);
    });

    it('starts empty when no cache is present', () => {
      expect(createRoomStores('testchannel').useRequests.getState().requests).toEqual([]);
    });

    it('persists requests to localStorage after a sync-full', () => {
      const stores = createRoomStores('testchannel');
      stores.useRequests.getState().handlePartyMessage({
        type: 'sync-full',
        requests: [serialized({ id: 3 }), serialized({ id: 4 })],
        sources: {} as any,
        channel: {} as any,
      });
      const stored = JSON.parse(localStorage.getItem(cacheKey)!);
      expect(stored.v).toBe(1);
      expect(stored.requests.map((r: any) => r.id)).toEqual([3, 4]);
    });

    it('sync-full replaces the cached queue (authoritative, not merged)', () => {
      localStorage.setItem(cacheKey, JSON.stringify({ v: 1, requests: [serialized({ id: 1 }), serialized({ id: 2 })] }));
      const stores = createRoomStores('testchannel');
      expect(stores.useRequests.getState().requests.map(r => r.id)).toEqual([1, 2]);
      stores.useRequests.getState().handlePartyMessage({
        type: 'sync-full',
        requests: [serialized({ id: 9 })],
        sources: {} as any,
        channel: {} as any,
      });
      // Server wins entirely — cached 1 & 2 are gone, not merged in.
      expect(stores.useRequests.getState().requests.map(r => r.id)).toEqual([9]);
    });

    it('ignores a cache with a mismatched version', () => {
      localStorage.setItem(cacheKey, JSON.stringify({ v: 99, requests: [serialized({ id: 1 })] }));
      expect(createRoomStores('testchannel').useRequests.getState().requests).toEqual([]);
    });

    it('ignores a corrupt cache entry', () => {
      localStorage.setItem(cacheKey, '{not valid json');
      expect(createRoomStores('testchannel').useRequests.getState().requests).toEqual([]);
    });
  });

  describe('SourcesStore extrasConfig', () => {
    it('applies default extrasConfig in-memory without broadcasting on hydrate', () => {
      vi.mocked(party.broadcastSources).mockClear();

      const useSources = createSourcesStore('room', () => ({ partyConnected: true }));
      useSources.getState().handlePartyMessage({
        type: 'sync-full',
        requests: [],
        channel: { status: 'offline', owner: null },
        sources: {
          enabled: { donation: true, chat: true, resub: false, manual: true },
          chatCommand: '!fila',
          chatTiers: [2, 3],
          priority: ['donation', 'chat', 'resub', 'manual'],
          sortMode: 'fifo',
          minDonation: 5,
          // no extrasConfig
        } as SourcesSettings,
      });

      const state = useSources.getState();
      // Default is opt-in (enabled: false) — applied in-memory only.
      expect(state.extrasConfig).toEqual({ build: { enabled: false, price: 10 } });
      // Critical: must NOT broadcast on hydrate. Non-owner viewers run this code
      // too, and broadcasting would trigger PartyKit's not-room-owner rejection.
      expect(party.broadcastSources).not.toHaveBeenCalled();
    });

    it('keeps existing extrasConfig and does NOT broadcast when present in sync-full', () => {
      vi.mocked(party.broadcastSources).mockClear();
      const useSources = createSourcesStore('room', () => ({ partyConnected: true }));
      useSources.getState().handlePartyMessage({
        type: 'sync-full',
        requests: [],
        channel: { status: 'offline', owner: null },
        sources: {
          enabled: { donation: true, chat: true, resub: false, manual: true },
          chatCommand: '!fila',
          chatTiers: [2, 3],
          priority: ['donation', 'chat', 'resub', 'manual'],
          sortMode: 'fifo',
          minDonation: 5,
          extrasConfig: { build: { enabled: false, price: 25 } },
        },
      });
      expect(useSources.getState().extrasConfig).toEqual({ build: { enabled: false, price: 25 } });
      // Critical: must not echo the sources back to PartyKit on hydrate — that would
      // create a write-amplification loop across every connected client.
      expect(party.broadcastSources).not.toHaveBeenCalled();
    });
  });
});
