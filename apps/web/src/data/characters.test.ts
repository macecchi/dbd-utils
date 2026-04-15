import { describe, it, expect } from 'vitest';
import { tryLocalMatch } from './characters';

describe('tryLocalMatch', () => {
  it('matches a single alias', () => {
    expect(tryLocalMatch('quero huntress')).toMatchObject({ character: 'Huntress', type: 'killer' });
  });

  it('prefers longer multi-word alias over substring at same position', () => {
    // "Vecna" matches both Lich and The First, but "Vecna Novo" should win for The First.
    const result = tryLocalMatch('vecna novo');
    expect(result).toMatchObject({ character: 'The First', type: 'killer' });
    expect(result?.ambiguous).toBeFalsy();
  });

  it('still picks Lich for plain "vecna"', () => {
    // Both Lich and The First list "Vecna" as alias; this stays ambiguous and
    // last-encountered wins (Lich is iterated first, so kept after dedup).
    const result = tryLocalMatch('quero vecna');
    expect(result?.character).toBe('Lich');
    expect(result?.ambiguous).toBe(true);
  });
});
