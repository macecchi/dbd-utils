import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleMessage, setActiveStores } from './twitch';
import { identifyMultiple } from './llm';
import type { ChannelStores } from '../store/channel';
import type { Request } from '@dbd-utils/shared';

vi.mock('./llm', () => ({
  identifyMultiple: vi.fn(async () => []),
}));

vi.mock('../store/auth', () => ({
  useAuth: { getState: () => ({ isAuthenticated: true }) },
}));

const identifyMultipleMock = vi.mocked(identifyMultiple);

function donationRaw(donor: string, amount: number, message: string): string {
  return `@display-name=livepix;color=#FF0000 :livepix!livepix@livepix.tmi.twitch.tv PRIVMSG #test :${donor} doou R$ ${amount},00: ${message}`;
}

describe('handleMessage — above-minimum donation routing', () => {
  let added: Request[];

  beforeEach(() => {
    added = [];
    setActiveStores({
      useSources: {
        getState: () => ({
          enabled: { donation: true },
          chatCommand: '!fila',
          minDonation: 5,
          extrasConfig: undefined,
        }),
      },
      useRequests: {
        getState: () => ({ add: (r: Request) => added.push(r) }),
      },
    } as unknown as ChannelStores);
  });

  afterEach(() => {
    identifyMultipleMock.mockClear();
    setActiveStores(null);
  });

  it('skips the LLM and adds one local request when an above-min donation is exactly one character', () => {
    // R$50 with min R$5 → entitlement 10 (multi-request path)
    handleMessage(donationRaw('Bob', 50, 'Trapper'));

    expect(identifyMultipleMock).not.toHaveBeenCalled();
    expect(added).toHaveLength(1);
    expect(added[0].character).toBe('Trapper');
    expect(added[0].type).toBe('killer');
    expect(added[0].needsIdentification).toBe(false);
  });

  it('still calls the LLM when an above-min donation contains more than the character name', () => {
    handleMessage(donationRaw('Bob', 50, 'Trapper e Nurse'));

    expect(identifyMultipleMock).toHaveBeenCalledTimes(1);
    expect(identifyMultipleMock).toHaveBeenCalledWith('Trapper e Nurse', 10, expect.anything());
  });

  it('still calls the LLM when an above-min donation has build text after the character', () => {
    handleMessage(donationRaw('Bob', 50, 'Trapper com mori'));

    expect(identifyMultipleMock).toHaveBeenCalledTimes(1);
  });
});
