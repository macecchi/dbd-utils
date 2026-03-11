import { describe, it, expect } from 'vitest';
import { sortRequests, mergeRequests } from './requests';
import type { Request } from '../types';

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

describe('sortRequests', () => {
  it('fifo mode sorts by timestamp', () => {
    const early = createTestRequest({ id: 1, timestamp: new Date('2024-01-01T00:00:00') });
    const late = createTestRequest({ id: 2, timestamp: new Date('2024-01-01T01:00:00') });
    const result = sortRequests([late, early], 'fifo', []);
    expect(result.map(r => r.id)).toEqual([1, 2]);
  });

  it('priority mode sorts done to end', () => {
    const done = createTestRequest({ id: 1, done: true, source: 'donation' });
    const pending = createTestRequest({ id: 2, done: false, source: 'chat' });
    const result = sortRequests([done, pending], 'priority', ['donation', 'chat']);
    expect(result.map(r => r.id)).toEqual([2, 1]);
  });

  it('priority mode sorts by source priority then timestamp', () => {
    const chat = createTestRequest({ id: 1, source: 'chat', timestamp: new Date('2024-01-01T00:00:00') });
    const donation = createTestRequest({ id: 2, source: 'donation', timestamp: new Date('2024-01-01T01:00:00') });
    const chatLater = createTestRequest({ id: 3, source: 'chat', timestamp: new Date('2024-01-01T02:00:00') });
    const result = sortRequests([chatLater, chat, donation], 'priority', ['donation', 'chat']);
    expect(result.map(r => r.id)).toEqual([2, 1, 3]);
  });
});

describe('mergeRequests', () => {
  it('deduplicates by ID', () => {
    const existing = [createTestRequest({ id: 1 })];
    const selected = [createTestRequest({ id: 1 }), createTestRequest({ id: 2 })];
    const { merged, added, skipped } = mergeRequests(selected, existing, 'fifo', []);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(merged).toHaveLength(2);
  });

  it('returns correct added/skipped counts', () => {
    const existing = [createTestRequest({ id: 1 }), createTestRequest({ id: 2 })];
    const selected = [
      createTestRequest({ id: 1 }),
      createTestRequest({ id: 2 }),
      createTestRequest({ id: 3 }),
    ];
    const { added, skipped } = mergeRequests(selected, existing, 'fifo', []);
    expect(added).toBe(1);
    expect(skipped).toBe(2);
  });

  it('with empty selected returns existing unchanged', () => {
    const existing = [createTestRequest({ id: 1 })];
    const { merged, added, skipped } = mergeRequests([], existing, 'fifo', []);
    expect(merged).toHaveLength(1);
    expect(added).toBe(0);
    expect(skipped).toBe(0);
  });
});
