import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sign } from 'hono/jwt';
import app from './index';

// Mock gemini
vi.mock('./gemini', () => ({
  extractCharacter: vi.fn().mockResolvedValue({
    character: 'Meg Thomas',
    type: 'survivor',
  }),
}));

const TEST_ENV = {
  TWITCH_CLIENT_ID: 'test-client-id',
  TWITCH_CLIENT_SECRET: 'test-client-secret',
  JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
  FRONTEND_URL: 'https://example.com/app',
  GEMINI_API_KEY: 'test-gemini-key',
};

// Helper to create a valid JWT
async function createTestToken(payload: Record<string, unknown> = {}, expiresIn = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: '12345',
      login: 'testuser',
      display_name: 'TestUser',
      profile_image_url: 'https://example.com/avatar.png',
      exp: now + expiresIn,
      ...payload,
    },
    TEST_ENV.JWT_SECRET,
    'HS256'
  );
}

describe('Hono API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS', () => {
    it('includes CORS headers for frontend origin', async () => {
      const res = await app.request('/auth/me', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
        },
      }, TEST_ENV);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });

  // Note: OAuth routes (/auth/login, /auth/callback) require integration testing
  // with the arctic library and Twitch API, which is complex to mock properly.
  // These are tested manually and in staging environments.

  describe('GET /auth/callback', () => {
    it('redirects with error when code is missing', async () => {
      const res = await app.request('/auth/callback', {}, TEST_ENV);

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toContain('error=missing_code');
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 400 when refresh_token is missing', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, TEST_ENV);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('missing_refresh_token');
    });

    it('returns 401 when refresh_token is invalid', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'invalid-token' }),
      }, TEST_ENV);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('invalid_refresh_token');
    });

    it('returns new access_token when refresh_token is valid', async () => {
      const refreshToken = await createTestToken({}, 60 * 60 * 24 * 90); // 90 days

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.access_token).toBeDefined();
      expect(typeof body.access_token).toBe('string');
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await app.request('/auth/me', {}, TEST_ENV);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('unauthorized');
    });

    it('returns 401 when Authorization header format is wrong', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Basic abc123' },
      }, TEST_ENV);

      expect(res.status).toBe(401);
    });

    it('returns 401 when token is invalid', async () => {
      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer invalid-token' },
      }, TEST_ENV);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('invalid_token');
    });

    it('returns 401 when token is expired', async () => {
      const expiredToken = await createTestToken({}, -3600); // expired 1 hour ago

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      }, TEST_ENV);

      expect(res.status).toBe(401);
    });

    it('returns user info when token is valid', async () => {
      const token = await createTestToken();

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('12345');
      expect(body.login).toBe('testuser');
      expect(body.display_name).toBe('TestUser');
    });
  });

  describe('POST /api/extract-character', () => {
    it('returns 401 when not authenticated', async () => {
      const res = await app.request('/api/extract-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'quero meg' }),
      }, TEST_ENV);

      expect(res.status).toBe(401);
    });

    it('returns 400 when message is missing', async () => {
      const token = await createTestToken();

      const res = await app.request('/api/extract-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      }, TEST_ENV);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid_input');
    });

    it('returns character extraction result', async () => {
      const token = await createTestToken();

      const res = await app.request('/api/extract-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: 'quero meg' }),
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.character).toBe('Meg Thomas');
      expect(body.type).toBe('survivor');
    });

    it('returns 502 when Gemini fails', async () => {
      const { extractCharacter } = await import('./gemini');
      vi.mocked(extractCharacter).mockRejectedValueOnce(new Error('API rate limit'));

      const token = await createTestToken();

      const res = await app.request('/api/extract-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: 'quero meg' }),
      }, TEST_ENV);

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('llm_error');
    });
  });
});
