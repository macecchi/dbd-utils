import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyServer from './party';
import type { SerializedRequest, SourcesSettings, PartyMessage } from '@dbd-utils/shared';

// Mock jwt module
vi.mock('./jwt', () => ({
  verifyJwt: vi.fn(),
}));

import { verifyJwt } from './jwt';

// Helper to create mock Party.Room
function createMockRoom(id: string = 'testchannel') {
  const connections = new Map<string, MockConnection>();

  return {
    id,
    env: { JWT_SECRET: 'test-secret' },
    storage: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
    getConnections: () => connections.values(),
    _connections: connections,
  };
}

// Helper to create mock connection
class MockConnection {
  id: string;
  messages: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  send(message: string) {
    this.messages.push(message);
  }

  getLastMessage(): PartyMessage | null {
    if (this.messages.length === 0) return null;
    return JSON.parse(this.messages[this.messages.length - 1]);
  }

  getAllMessages(): PartyMessage[] {
    return this.messages.map(m => JSON.parse(m));
  }
}

function createMockContext(token: string | null = null) {
  const url = token
    ? `https://party.example.com/room?token=${token}`
    : 'https://party.example.com/room';
  return {
    request: { url },
  };
}

function createTestRequest(overrides: Partial<SerializedRequest> = {}): SerializedRequest {
  return {
    id: Date.now(),
    donor: 'TestUser',
    message: 'Test message',
    character: 'Meg Thomas',
    type: 'survivor',
    amount: 10,
    source: 'manual',
    done: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('PartyServer', () => {
  let server: PartyServer;
  let mockRoom: ReturnType<typeof createMockRoom>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = createMockRoom();
    server = new PartyServer(mockRoom as any);
  });

  describe('onStart', () => {
    it('initializes with empty state when storage is empty', async () => {
      await server.onStart();

      expect(server.requests).toEqual([]);
      expect(server.channel.status).toBe('offline');
    });

    it('loads requests from storage', async () => {
      const storedRequests = [createTestRequest({ id: 1 }), createTestRequest({ id: 2 })];
      mockRoom.storage.get.mockImplementation((key: string) => {
        if (key === 'requests') return Promise.resolve(storedRequests);
        return Promise.resolve(null);
      });

      await server.onStart();

      expect(server.requests).toEqual(storedRequests);
    });

    it('loads sources from storage with defaults merged', async () => {
      const storedSources = { minDonation: 10 };
      mockRoom.storage.get.mockImplementation((key: string) => {
        if (key === 'sources') return Promise.resolve(storedSources);
        return Promise.resolve(null);
      });

      await server.onStart();

      expect(server.sources.minDonation).toBe(10);
      expect(server.sources.chatCommand).toBe('!fila'); // default
    });
  });

  describe('onConnect', () => {
    it('sends sync-full message to new connection', async () => {
      const conn = new MockConnection('conn1');
      const ctx = createMockContext();

      await server.onConnect(conn as any, ctx as any);

      const msg = conn.getLastMessage();
      expect(msg?.type).toBe('sync-full');
      expect(msg).toHaveProperty('requests');
      expect(msg).toHaveProperty('sources');
      expect(msg).toHaveProperty('channel');
    });

    it('identifies owner when JWT matches room id', async () => {
      vi.mocked(verifyJwt).mockResolvedValue({
        sub: '123',
        login: 'testchannel',
        display_name: 'TestChannel',
        profile_image_url: 'https://example.com/avatar.png',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const conn = new MockConnection('conn1');
      const ctx = createMockContext('valid-token');

      await server.onConnect(conn as any, ctx as any);

      expect(server.connections.get('conn1')?.isOwner).toBe(true);
      expect(server.channel.status).toBe('online');
      expect(server.channel.owner?.login).toBe('testchannel');
    });

    it('does not identify owner when JWT login differs from room id', async () => {
      vi.mocked(verifyJwt).mockResolvedValue({
        sub: '456',
        login: 'otheruser',
        display_name: 'OtherUser',
        profile_image_url: 'https://example.com/avatar.png',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const conn = new MockConnection('conn1');
      const ctx = createMockContext('valid-token');

      await server.onConnect(conn as any, ctx as any);

      expect(server.connections.get('conn1')?.isOwner).toBe(false);
      expect(server.channel.status).toBe('offline');
    });

    it('handles anonymous connection', async () => {
      const conn = new MockConnection('conn1');
      const ctx = createMockContext(null);

      await server.onConnect(conn as any, ctx as any);

      expect(server.connections.get('conn1')?.isOwner).toBe(false);
      expect(server.connections.get('conn1')?.user).toBeNull();
    });

    it('handles invalid JWT', async () => {
      vi.mocked(verifyJwt).mockResolvedValue(null);

      const conn = new MockConnection('conn1');
      const ctx = createMockContext('invalid-token');

      await server.onConnect(conn as any, ctx as any);

      expect(server.connections.get('conn1')?.isOwner).toBe(false);
    });
  });

  describe('onClose', () => {
    it('removes connection from map', async () => {
      const conn = new MockConnection('conn1');
      await server.onConnect(conn as any, createMockContext() as any);

      expect(server.connections.has('conn1')).toBe(true);

      server.onClose(conn as any);

      expect(server.connections.has('conn1')).toBe(false);
    });

    it('sets channel offline when owner disconnects', async () => {
      vi.mocked(verifyJwt).mockResolvedValue({
        sub: '123',
        login: 'testchannel',
        display_name: 'TestChannel',
        profile_image_url: 'https://example.com/avatar.png',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const conn = new MockConnection('conn1');
      await server.onConnect(conn as any, createMockContext('token') as any);

      expect(server.channel.status).toBe('online');

      server.onClose(conn as any);

      expect(server.channel.status).toBe('offline');
      expect(server.channel.owner).toBeNull();
    });
  });

  describe('onMessage', () => {
    let ownerConn: MockConnection;
    let viewerConn: MockConnection;

    beforeEach(async () => {
      // Set up owner connection
      vi.mocked(verifyJwt).mockResolvedValue({
        sub: '123',
        login: 'testchannel',
        display_name: 'TestChannel',
        profile_image_url: 'https://example.com/avatar.png',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      ownerConn = new MockConnection('owner');
      mockRoom._connections.set('owner', ownerConn);
      await server.onConnect(ownerConn as any, createMockContext('owner-token') as any);

      // Set up viewer connection
      vi.mocked(verifyJwt).mockResolvedValue(null);
      viewerConn = new MockConnection('viewer');
      mockRoom._connections.set('viewer', viewerConn);
      await server.onConnect(viewerConn as any, createMockContext() as any);

      // Clear messages from connect
      ownerConn.messages = [];
      viewerConn.messages = [];
    });

    it('rejects messages from non-owner', async () => {
      const msg = JSON.stringify({ type: 'add-request', request: createTestRequest() });

      await server.onMessage(msg, viewerConn as any);

      expect(server.requests).toHaveLength(0);
    });

    it('handles add-request from owner', async () => {
      const request = createTestRequest({ id: 100 });
      const msg = JSON.stringify({ type: 'add-request', request });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0].id).toBe(100);
      expect(mockRoom.storage.put).toHaveBeenCalledWith('requests', server.requests);

      // Should broadcast to viewer but not owner
      expect(viewerConn.messages).toHaveLength(1);
      expect(ownerConn.messages).toHaveLength(0);
    });

    it('prevents duplicate requests', async () => {
      const request = createTestRequest({ id: 100 });
      const msg = JSON.stringify({ type: 'add-request', request });

      await server.onMessage(msg, ownerConn as any);
      await server.onMessage(msg, ownerConn as any);

      expect(server.requests).toHaveLength(1);
    });

    it('handles update-request', async () => {
      server.requests = [createTestRequest({ id: 100, character: 'Meg Thomas' })];
      const msg = JSON.stringify({ type: 'update-request', id: 100, updates: { character: 'Dwight Fairfield' } });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests[0].character).toBe('Dwight Fairfield');
      expect(mockRoom.storage.put).toHaveBeenCalled();
    });

    it('handles toggle-done', async () => {
      server.requests = [createTestRequest({ id: 100, done: false })];
      const msg = JSON.stringify({ type: 'toggle-done', id: 100 });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests[0].done).toBe(true);
    });

    it('handles delete-request', async () => {
      server.requests = [createTestRequest({ id: 100 }), createTestRequest({ id: 200 })];
      const msg = JSON.stringify({ type: 'delete-request', id: 100 });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests).toHaveLength(1);
      expect(server.requests[0].id).toBe(200);
    });

    it('handles reorder', async () => {
      server.requests = [
        createTestRequest({ id: 1 }),
        createTestRequest({ id: 2 }),
        createTestRequest({ id: 3 }),
      ];
      const msg = JSON.stringify({ type: 'reorder', fromId: 3, toId: 1 });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests.map(r => r.id)).toEqual([3, 1, 2]);
    });

    it('handles set-all', async () => {
      const newRequests = [createTestRequest({ id: 10 }), createTestRequest({ id: 20 })];
      const msg = JSON.stringify({ type: 'set-all', requests: newRequests });

      await server.onMessage(msg, ownerConn as any);

      expect(server.requests).toEqual(newRequests);
    });

    it('handles update-sources', async () => {
      const newSources: SourcesSettings = {
        enabled: { donation: false, chat: true, resub: true, manual: false },
        chatCommand: '!request',
        chatTiers: [1, 2, 3],
        priority: ['chat', 'donation', 'resub', 'manual'],
        sortMode: 'priority',
        minDonation: 20,
      };
      const msg = JSON.stringify({ type: 'update-sources', sources: newSources });

      await server.onMessage(msg, ownerConn as any);

      expect(server.sources).toEqual(newSources);
      expect(mockRoom.storage.put).toHaveBeenCalledWith('sources', newSources);
    });

    it('handles irc-status connected', async () => {
      server.channel.status = 'online';
      const msg = JSON.stringify({ type: 'irc-status', connected: true });

      await server.onMessage(msg, ownerConn as any);

      expect(server.channel.status).toBe('live');
    });

    it('handles irc-status disconnected', async () => {
      server.channel.status = 'live';
      const msg = JSON.stringify({ type: 'irc-status', connected: false });

      await server.onMessage(msg, ownerConn as any);

      expect(server.channel.status).toBe('online');
    });

    it('ignores invalid JSON', async () => {
      await server.onMessage('not valid json', ownerConn as any);

      expect(server.requests).toHaveLength(0);
    });
  });

  describe('broadcast', () => {
    it('broadcasts to all connections except sender', async () => {
      vi.mocked(verifyJwt).mockResolvedValue({
        sub: '123',
        login: 'testchannel',
        display_name: 'TestChannel',
        profile_image_url: 'https://example.com/avatar.png',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const owner = new MockConnection('owner');
      const viewer1 = new MockConnection('viewer1');
      const viewer2 = new MockConnection('viewer2');

      mockRoom._connections.set('owner', owner);
      mockRoom._connections.set('viewer1', viewer1);
      mockRoom._connections.set('viewer2', viewer2);

      await server.onConnect(owner as any, createMockContext('token') as any);

      vi.mocked(verifyJwt).mockResolvedValue(null);
      await server.onConnect(viewer1 as any, createMockContext() as any);
      await server.onConnect(viewer2 as any, createMockContext() as any);

      // Clear sync messages
      owner.messages = [];
      viewer1.messages = [];
      viewer2.messages = [];

      // Owner adds a request
      const request = createTestRequest({ id: 1 });
      await server.onMessage(JSON.stringify({ type: 'add-request', request }), owner as any);

      // Owner should not receive broadcast
      expect(owner.messages).toHaveLength(0);

      // Viewers should receive broadcast
      expect(viewer1.messages).toHaveLength(1);
      expect(viewer2.messages).toHaveLength(1);
    });
  });
});
