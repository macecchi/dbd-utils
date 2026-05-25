import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { identifyCharacter } from './llm';
import type { Request } from '@dbd-utils/shared';

vi.mock('../store/auth', () => ({
  useAuth: {
    getState: () => ({ isAuthenticated: true, getAccessToken: async () => 'token' }),
  },
}));

function makeRequest(message: string): Request {
  return {
    id: 1,
    timestamp: new Date(),
    donor: 'Donor',
    amount: 'R$10',
    amountVal: 10,
    message,
    character: '',
    type: 'unknown',
    source: 'donation',
  };
}

describe('identifyCharacter — skip LLM when local match is the whole message', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    // Injected by Vite's `define` in the real build; absent under vitest.
    vi.stubGlobal('__APP_VERSION__', 'test');
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('does not call the LLM when the matched term is the entire message, even with extras requested', async () => {
    const result = await identifyCharacter(makeRequest('Trapper'), ['build'], undefined, () => {});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.character).toBe('Trapper');
    expect(result.type).toBe('killer');
    expect(result.validating).toBeUndefined();
  });

  it('ignores surrounding whitespace and case when comparing match to message', async () => {
    const result = await identifyCharacter(makeRequest('  trapper  '), ['build'], undefined, () => {});

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.character).toBe('Trapper');
  });

  it('still calls the LLM for extras when the message has text beyond the character name', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ characters: [{ character: 'Trapper', type: 'killer' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const onLLMUpdate = vi.fn();
    const result = await identifyCharacter(
      makeRequest('Trapper com build de mori'),
      ['build'],
      undefined,
      onLLMUpdate
    );

    expect(result.validating).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('routes a prose message with an embedded local match to the LLM (no extras)', async () => {
    // "Trapper" matches locally but it is context ("a dull Trapper two"), not a
    // request. The local match must NOT short-circuit the LLM anymore.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ characters: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const onLLMUpdate = vi.fn();
    const result = await identifyCharacter(
      makeRequest('se for o Jason vai ser um Trapper dois sem graça'),
      [],
      undefined,
      onLLMUpdate
    );

    expect(result.validating).toBe(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // LLM is authoritative: it returned no character, so the local guess is dropped.
    await vi.waitFor(() =>
      expect(onLLMUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ character: '', validating: false })
      )
    );
  });
});
