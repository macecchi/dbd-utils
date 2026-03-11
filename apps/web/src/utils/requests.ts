import type { Request } from '../types';

type SortMode = 'priority' | 'fifo';

export function sortRequests(requests: Request[], sortMode: SortMode, priority: string[]): Request[] {
  const sorted = [...requests];
  if (sortMode === 'fifo') {
    sorted.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } else {
    sorted.sort((a, b) => {
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;
      const aPri = priority.indexOf(a.source);
      const bPri = priority.indexOf(b.source);
      if (aPri !== bPri) return aPri - bPri;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }
  return sorted;
}

export function mergeRequests(
  selected: Request[],
  existing: Request[],
  sortMode: SortMode,
  priority: string[]
): { merged: Request[]; added: number; skipped: number } {
  const existingIds = new Set(existing.map(r => r.id));
  const newReqs = selected.filter(r => !existingIds.has(r.id));
  return {
    merged: sortRequests([...existing, ...newReqs], sortMode, priority),
    added: newReqs.length,
    skipped: selected.length - newReqs.length,
  };
}
