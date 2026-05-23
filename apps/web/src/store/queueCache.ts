// Per-room queue cache (localStorage). Lets a reload render the last-known queue
// instantly instead of waiting on the PartyKit `sync-full` round-trip. This is a
// stale-while-revalidate *cache*, never authoritative: the PartyKit Durable
// Object remains the source of truth and `sync-full` replaces whatever is here.
//
// Release-impact: this is new client-only persisted state. The key is versioned
// (`v1`) and reads are fully defensive (bad/old shapes are ignored, never thrown),
// so an old cache can never break a newer client and no server migration is
// needed — bump VERSION to invalidate cleanly on a future shape change.
import { serializeRequest, deserializeRequest } from '../types';
import type { Request, SerializedRequest } from '../types';

const VERSION = 1;

const keyFor = (channel: string) => `fila-dbd-queue-v${VERSION}-${channel.toLowerCase()}`;

interface QueueCacheEnvelope {
  v: number;
  requests: SerializedRequest[];
}

export function loadCachedQueue(channel: string): Request[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyFor(channel));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueCacheEnvelope | null;
    if (!parsed || parsed.v !== VERSION || !Array.isArray(parsed.requests)) return [];
    return parsed.requests.map(deserializeRequest);
  } catch {
    return [];
  }
}

export function saveCachedQueue(channel: string, requests: Request[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const envelope: QueueCacheEnvelope = { v: VERSION, requests: requests.map(serializeRequest) };
    localStorage.setItem(keyFor(channel), JSON.stringify(envelope));
  } catch {
    // ignore quota / serialization / storage-unavailable errors — the cache is
    // an optimization, not a requirement.
  }
}
