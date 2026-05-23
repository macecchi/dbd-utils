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

// ---- Pure queue ops, shared by optimistic actions and the PartyKit echo handlers ----
//
// Each returns the SAME array reference when nothing changes, so a zustand
// `set(() => fn(...))` is a no-op (no re-render) for a duplicate/no-op echo.

/** Insert a request at its sorted position. Dedupes by id (returns input unchanged). */
export function insertRequest(
  requests: Request[],
  req: Request,
  sortMode: SortMode,
  priority: string[]
): Request[] {
  if (requests.some(r => r.id === req.id)) return requests;
  if (sortMode === 'fifo') return [...requests, req];
  const out = [...requests];
  const reqPri = priority.indexOf(req.source);
  let insertIdx = out.length;
  for (let i = 0; i < out.length; i++) {
    if (out[i].done) continue;
    const iPri = priority.indexOf(out[i].source);
    if (iPri > reqPri || (iPri === reqPri && out[i].timestamp > req.timestamp)) {
      insertIdx = i;
      break;
    }
  }
  out.splice(insertIdx, 0, req);
  return out;
}

/** Move the request `fromId` to the position of `toId`. No-op if either is missing. */
export function moveRequest(requests: Request[], fromId: number, toId: number): Request[] {
  const fromIdx = requests.findIndex(r => r.id === fromId);
  const toIdx = requests.findIndex(r => r.id === toId);
  if (fromIdx === -1 || toIdx === -1) return requests;
  const out = [...requests];
  const [moved] = out.splice(fromIdx, 1);
  out.splice(toIdx, 0, moved);
  return out;
}

/** Set a request's done state (and doneAt). No-op if the id is absent. */
export function setRequestDone(requests: Request[], id: number, done: boolean, doneAt?: Date): Request[] {
  let changed = false;
  const out = requests.map(r => {
    if (r.id !== id) return r;
    changed = true;
    return { ...r, done, doneAt: done ? (doneAt ?? new Date()) : undefined };
  });
  return changed ? out : requests;
}
