import { describe, it, expect, vi } from 'vitest';
import { importWithReload, RELOAD_FLAG } from './lazyWithReload';

function memStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('importWithReload', () => {
  it('resolves with the module and clears the reload flag on success', async () => {
    const storage = memStorage({ [RELOAD_FLAG]: '1' });
    const reload = vi.fn();
    const mod = { default: 'X' };

    const result = await importWithReload(() => Promise.resolve(mod), { reload, storage });

    expect(result).toBe(mod);
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem(RELOAD_FLAG)).toBeNull();
  });

  it('reloads once on the first import failure and keeps the promise pending', async () => {
    const storage = memStorage();
    const reload = vi.fn();
    let settled = false;

    void importWithReload(() => Promise.reject(new Error('Failed to fetch dynamically imported module')), { reload, storage })
      .then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    await Promise.resolve();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(RELOAD_FLAG)).toBe('1');
    // Never resolves/rejects: Suspense stays in its fallback until the reload swaps the page.
    expect(settled).toBe(false);
  });

  it('rethrows without reloading again if a reload was already attempted', async () => {
    const storage = memStorage({ [RELOAD_FLAG]: '1' });
    const reload = vi.fn();
    const err = new Error('Failed to fetch dynamically imported module');

    await expect(importWithReload(() => Promise.reject(err), { reload, storage })).rejects.toBe(err);
    expect(reload).not.toHaveBeenCalled();
  });
});
