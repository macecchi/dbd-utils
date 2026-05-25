import { lazy } from 'react';

export const RELOAD_FLAG = 'dbd-chunk-reload';

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// A lazily-loaded chunk can 404 when the loaded index.html references a hash that was
// purged (rolling deploy) or evicted from the SW precache. Recover by reloading once —
// a fresh index.html points at the current hashes. Guard with a flag so a chunk that is
// genuinely gone doesn't loop; after one failed reload we surface the error instead.
export function importWithReload<T>(
  factory: () => Promise<T>,
  deps: { reload?: () => void; storage?: MinimalStorage } = {}
): Promise<T> {
  const reload = deps.reload ?? (() => window.location.reload());
  const storage = deps.storage ?? window.sessionStorage;

  return factory().then(
    (mod) => {
      storage.removeItem(RELOAD_FLAG);
      return mod;
    },
    (err) => {
      if (!storage.getItem(RELOAD_FLAG)) {
        storage.setItem(RELOAD_FLAG, '1');
        reload();
        // Keep Suspense in its fallback until the reload swaps the document.
        return new Promise<T>(() => {});
      }
      throw err;
    }
  );
}

// Drop-in for React.lazy that recovers from a stale-deploy chunk 404. Borrows lazy's
// exact signature so component prop types are preserved through the wrapper.
export const lazyWithReload: typeof lazy = (factory) => lazy(() => importWithReload(factory));
