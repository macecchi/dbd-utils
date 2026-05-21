import { describe, it, expect } from 'vitest';
import { computeEntitlement, buildDonationRequests, MAX_DONATION_REQUESTS } from './donation';

describe('computeEntitlement', () => {
  it('returns 1 when amount equals minimum', () => {
    expect(computeEntitlement(5, 5)).toBe(1);
  });

  it('returns floor(amount / min) for multiples', () => {
    expect(computeEntitlement(10, 5)).toBe(2);
    expect(computeEntitlement(14, 5)).toBe(2);
    expect(computeEntitlement(15, 5)).toBe(3);
  });

  it('caps at MAX_DONATION_REQUESTS', () => {
    expect(computeEntitlement(1000, 5)).toBe(MAX_DONATION_REQUESTS);
  });

  it('returns 1 when min is 0 or undefined (degenerate)', () => {
    expect(computeEntitlement(10, 0)).toBe(1);
  });

  it('returns 1 when amount is below min (should not be called, but is safe)', () => {
    expect(computeEntitlement(3, 5)).toBe(1);
  });
});

describe('buildDonationRequests', () => {
  const baseInput = {
    donor: 'Donor',
    amount: 'R$10',
    amountVal: 10,
    message: 'Trapper e Nurse',
    twitchMsgId: 'twitch-abc',
    timestampMs: 1_700_000_000_000,
  };

  it('builds one request per identified character with shared originMsgId', () => {
    const out = buildDonationRequests({
      ...baseInput,
      identified: [
        { character: 'Trapper', type: 'killer', matchedTerm: 'Trapper' },
        { character: 'Nurse', type: 'killer', matchedTerm: 'Nurse' },
      ],
    });

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      donor: 'Donor', amount: 'R$10', amountVal: 10, message: 'Trapper e Nurse',
      character: 'Trapper', type: 'killer', source: 'donation',
      needsIdentification: false, matchedTerm: 'Trapper',
      originMsgId: 'twitch-abc',
    });
    expect(out[1].character).toBe('Nurse');
    expect(out[0].originMsgId).toBe(out[1].originMsgId);
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('preserves duplicate characters in order', () => {
    const out = buildDonationRequests({
      ...baseInput,
      message: '2 de trapper e 1 de nurse',
      identified: [
        { character: 'Trapper', type: 'killer' },
        { character: 'Trapper', type: 'killer' },
        { character: 'Nurse', type: 'killer' },
      ],
    });
    expect(out.map(r => r.character)).toEqual(['Trapper', 'Trapper', 'Nurse']);
    expect(new Set(out.map(r => r.id)).size).toBe(3);
  });

  it('returns a single "needs identification" request when identified is empty', () => {
    const out = buildDonationRequests({ ...baseInput, identified: [] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      character: 'Identificando...',
      type: 'unknown',
      needsIdentification: true,
      originMsgId: 'twitch-abc',
      message: 'Trapper e Nurse',
    });
  });

  it('falls back to synthetic originMsgId when Twitch id is missing', () => {
    const out = buildDonationRequests({ ...baseInput, twitchMsgId: undefined, identified: [
      { character: 'Trapper', type: 'killer' },
      { character: 'Nurse', type: 'killer' },
    ] });
    expect(out[0].originMsgId).toBeTruthy();
    expect(out[0].originMsgId).toBe(out[1].originMsgId);
    expect(out[0].originMsgId).toContain('Donor');
  });
});
