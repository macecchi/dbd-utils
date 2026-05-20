import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBotToken, refreshBotToken, sendChatMessage, checkBotIsMod, type BotToken } from './twitch';

function createMockKV() {
  const store = new Map<string, { value: string; expiry?: number }>();
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiry && Date.now() > entry.expiry) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      const expiry = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined;
      store.set(key, { value, expiry });
    }),
    _store: store,
  };
}

const TEST_ENV = {
  TWITCH_CLIENT_ID: 'test-client-id',
  TWITCH_CLIENT_SECRET: 'test-client-secret',
  CACHE: createMockKV(),
};

function makeBotToken(overrides: Partial<BotToken> = {}): BotToken {
  return {
    access_token: 'access-1',
    refresh_token: 'refresh-1',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user_id: 'bot-user-id',
    login: 'filadbd',
    ...overrides,
  };
}

async function seedBotToken(env: typeof TEST_ENV, token: BotToken) {
  await env.CACHE.put('bot_token', JSON.stringify(token));
}

describe('twitch — bot token helpers', () => {
  beforeEach(() => {
    TEST_ENV.CACHE._store.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getBotToken', () => {
    it('returns cached token when not near expiry', async () => {
      const token = makeBotToken();
      await seedBotToken(TEST_ENV, token);
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const result = await getBotToken(TEST_ENV as never);

      expect(result?.access_token).toBe('access-1');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns null when no token in KV', async () => {
      const result = await getBotToken(TEST_ENV as never);
      expect(result).toBeNull();
    });

    it('refreshes token when expiry is within 60s', async () => {
      const expiring = makeBotToken({ expires_at: Math.floor(Date.now() / 1000) + 30 });
      await seedBotToken(TEST_ENV, expiring);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 14000 }),
      }));

      const result = await getBotToken(TEST_ENV as never);

      expect(result?.access_token).toBe('access-2');
      expect(result?.refresh_token).toBe('refresh-2');
      // Persisted back to KV
      const persisted = JSON.parse((await TEST_ENV.CACHE.get('bot_token'))!);
      expect(persisted.access_token).toBe('access-2');
    });

    it('returns null when refresh fails', async () => {
      const expiring = makeBotToken({ expires_at: Math.floor(Date.now() / 1000) - 1 });
      await seedBotToken(TEST_ENV, expiring);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      }));

      const result = await getBotToken(TEST_ENV as never);
      expect(result).toBeNull();
    });
  });

  describe('refreshBotToken', () => {
    it('persists rotated refresh_token', async () => {
      const current = makeBotToken();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 14000 }),
      }));

      const result = await refreshBotToken(TEST_ENV as never, current);

      expect(result?.refresh_token).toBe('new-refresh');
      const persisted = JSON.parse((await TEST_ENV.CACHE.get('bot_token'))!);
      expect(persisted.refresh_token).toBe('new-refresh');
      expect(persisted.user_id).toBe(current.user_id);
      expect(persisted.login).toBe(current.login);
    });
  });

  describe('sendChatMessage', () => {
    it('returns no_bot_token when KV has no token', async () => {
      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no_bot_token');
    });

    it('returns no_broadcaster when broadcaster lookup fails', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [] }) };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'ghostchannel', 'hi');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no_broadcaster');
    });

    it('happy path: returns ok and message_id', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          return { ok: true, status: 200, json: async () => ({ data: [{ message_id: 'msg-123', is_sent: true }] }) };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.message_id).toBe('msg-123');
    });

    it('returns not_mod on 403', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          return { ok: false, status: 403, text: async () => 'forbidden' };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not_mod');
    });

    it('refreshes once on 401 and retries', async () => {
      await seedBotToken(TEST_ENV, makeBotToken({ access_token: 'stale' }));
      let chatCalls = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          const body = init?.body?.toString() ?? '';
          if (body.includes('grant_type=refresh_token')) {
            return { ok: true, json: async () => ({ access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 14000 }) };
          }
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          chatCalls++;
          if (chatCalls === 1) return { ok: false, status: 401, text: async () => 'expired' };
          return { ok: true, status: 200, json: async () => ({ data: [{ message_id: 'msg-1', is_sent: true }] }) };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(true);
      expect(chatCalls).toBe(2);
    });

    it('returns token_invalid when refresh still 401s', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          const body = init?.body?.toString() ?? '';
          if (body.includes('grant_type=refresh_token')) {
            return { ok: false, status: 400, text: async () => 'invalid_grant' };
          }
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          return { ok: false, status: 401, text: async () => 'expired' };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('token_invalid');
    });

    it('returns message_rejected when Twitch sets is_sent=false', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [{ message_id: 'msg-x', is_sent: false, drop_reason: { code: 'msg_duplicate', message: 'duplicate' } }] }),
          };
        }
        return { ok: false, status: 500 };
      }));

      const result = await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('message_rejected');
        expect(result.detail).toBe('msg_duplicate');
      }
    });

    it('caches broadcaster_id after first lookup', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      const helixUsersCalls: string[] = [];
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('id.twitch.tv/oauth2/token')) {
          return { ok: true, json: async () => ({ access_token: 'app-1', expires_in: 3600 }) };
        }
        if (url.includes('/helix/users')) {
          helixUsersCalls.push(url);
          return { ok: true, json: async () => ({ data: [{ id: 'broadcaster-1' }] }) };
        }
        if (url.includes('/helix/chat/messages')) {
          return { ok: true, status: 200, json: async () => ({ data: [{ message_id: 'msg', is_sent: true }] }) };
        }
        return { ok: false, status: 500 };
      }));

      await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi 1');
      await sendChatMessage(TEST_ENV as never, 'somechannel', 'hi 2');

      expect(helixUsersCalls).toHaveLength(1);
    });
  });

  describe('checkBotIsMod', () => {
    it('returns no_bot_token when KV empty', async () => {
      const result = await checkBotIsMod(TEST_ENV as never, 'somechannel');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no_bot_token');
    });

    it('returns is_mod=true when broadcaster is in the moderated channels list', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { broadcaster_login: 'someoneelse' },
            { broadcaster_login: 'targetchannel' },
          ],
        }),
      }));

      const result = await checkBotIsMod(TEST_ENV as never, 'TargetChannel');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.is_mod).toBe(true);
        expect(result.bot_login).toBe('filadbd');
      }
    });

    it('returns is_mod=false when broadcaster is not in the list (no pagination cursor)', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ broadcaster_login: 'someoneelse' }], pagination: {} }),
      }));

      const result = await checkBotIsMod(TEST_ENV as never, 'targetchannel');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.is_mod).toBe(false);
    });

    it('walks pagination to find a match on a later page', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      let page = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        page++;
        if (page === 1) {
          return { ok: true, json: async () => ({ data: [{ broadcaster_login: 'a' }], pagination: { cursor: 'cur1' } }) };
        }
        if (page === 2) {
          return { ok: true, json: async () => ({ data: [{ broadcaster_login: 'targetchannel' }], pagination: { cursor: 'cur2' } }) };
        }
        return { ok: true, json: async () => ({ data: [], pagination: {} }) };
      }));

      const result = await checkBotIsMod(TEST_ENV as never, 'targetchannel');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.is_mod).toBe(true);
      expect(page).toBe(2);
    });

    it('returns scope_missing when Twitch returns 401 with scope error', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Missing scope: user:read:moderated_channels',
      }));

      const result = await checkBotIsMod(TEST_ENV as never, 'targetchannel');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('scope_missing');
    });

    it('returns twitch_error on unexpected status', async () => {
      await seedBotToken(TEST_ENV, makeBotToken());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      }));

      const result = await checkBotIsMod(TEST_ENV as never, 'targetchannel');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('twitch_error');
    });
  });
});
