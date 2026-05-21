import { describe, it, expect } from 'vitest';
import { eligibleExtras } from './extras';
import { DEFAULT_EXTRAS_CONFIG } from '@dbd-utils/shared';

describe('eligibleExtras', () => {
  it('returns ["build"] when amount >= configured build price and enabled', () => {
    expect(eligibleExtras(10, DEFAULT_EXTRAS_CONFIG)).toEqual(['build']);
    expect(eligibleExtras(100, DEFAULT_EXTRAS_CONFIG)).toEqual(['build']);
  });
  it('returns [] when amount is below the build price', () => {
    expect(eligibleExtras(5, DEFAULT_EXTRAS_CONFIG)).toEqual([]);
    expect(eligibleExtras(9.99, DEFAULT_EXTRAS_CONFIG)).toEqual([]);
  });
  it('returns [] when build extra is disabled', () => {
    expect(eligibleExtras(100, { build: { enabled: false, price: 10 } })).toEqual([]);
  });
  it('returns [] when extrasConfig is missing the build key', () => {
    expect(eligibleExtras(100, {})).toEqual([]);
  });
  it('returns [] when extrasConfig is undefined', () => {
    expect(eligibleExtras(100, undefined)).toEqual([]);
  });
});
