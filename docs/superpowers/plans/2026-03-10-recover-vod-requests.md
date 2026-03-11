# Recover Requests from Past VODs — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let streamers recover requests from past VODs via a two-step UI: select VODs → review & import extracted requests.

**Architecture:** New `fetchRecentVods()` and `scanVODForRequests()` functions in `vod.ts` reuse existing GQL/parsing infra. New `VODSelectionDialog` component for step 1. Existing `MissedRequestsDialog` extended with `disabledIds` prop for step 2. New `RecoverRequestsCard` in SourcesPanel triggers the flow. State managed in `App.tsx` (same pattern as current VOD recovery).

**Tech Stack:** React, TypeScript, Twitch GQL API, existing `parseDonationMessage`/`tryLocalMatch` utilities.

---

## Chunk 1: Backend — VOD List & Chat Scanning

### Task 1: Add `fetchRecentVods()` to vod.ts

**Files:**
- Modify: `apps/web/src/services/vod.ts`

- [ ] **Step 1: Add VODInfo type and fetchRecentVods function**

Add after the existing `RecoveryCallbacks` interface (~line 168):

```typescript
export interface VODInfo {
  id: string;
  title: string;
  createdAt: string;
  lengthSeconds: number;
}

export async function fetchRecentVods(
  channel: string,
  count: number,
  cursor?: string
): Promise<{ vods: VODInfo[]; hasMore: boolean; endCursor: string | null }> {
  const data = await fetchGQL({
    query: `query($login:String!,$first:Int!,$after:String){user(login:$login){videos(first:$first,after:$after,type:ARCHIVE,sort:TIME){edges{node{id title createdAt lengthSeconds}cursor}pageInfo{hasNextPage}}}}`,
    variables: { login: channel, first: count, after: cursor || null }
  });
  const edges = data?.data?.user?.videos?.edges || [];
  const pageInfo = data?.data?.user?.videos?.pageInfo;
  return {
    vods: edges.map((e: { node: VODInfo }) => e.node),
    hasMore: pageInfo?.hasNextPage ?? false,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services/vod.ts
git commit -m "feat: add fetchRecentVods with cursor pagination"
```

### Task 2: Add `scanVODForRequests()` to vod.ts

**Files:**
- Modify: `apps/web/src/services/vod.ts`

- [ ] **Step 1: Add scanVODForRequests function**

Add after `fetchRecentVods`. This reuses the same scanning logic as `recoverMissedRequests` but without the "current VOD" lookup — it takes explicit VOD IDs and scans them. Uses `AbortSignal` for cancellation and `onRequest` callback for progressive results.

```typescript
export interface ScanConfig {
  botName: string;
  minDonation: number;
  sourcesEnabled: { donation: boolean; resub: boolean; chat: boolean; manual: boolean };
  chatCommand: string;
}

export interface ScanCallbacks {
  onProgress?: (status: string) => void;
  onRequest?: (request: Request) => void;
}

export async function scanVODForRequests(
  vodId: string,
  vodCreatedAt: string,
  config: ScanConfig,
  callbacks?: ScanCallbacks,
  signal?: AbortSignal
): Promise<Request[]> {
  const vodStart = new Date(vodCreatedAt).getTime();
  const botName = config.botName.toLowerCase();
  const chatCommand = config.chatCommand.toLowerCase();
  const requests: Request[] = [];
  const seen = new Set<string>();
  let offset = 0;

  while (!signal?.aborted) {
    const data = await fetchVODChat(vodId, offset);
    if (signal?.aborted) break;
    const edges = data?.data?.video?.comments?.edges || [];
    if (!edges.length) break;

    let newCount = 0, lastOffset = offset;
    for (const { node } of edges) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      newCount++;

      const username = node.commenter?.login?.toLowerCase() || '';
      const displayName = node.commenter?.displayName || username;
      const message = node.message?.fragments?.map((f: any) => f.text).join('') || '';
      lastOffset = node.contentOffsetSeconds || lastOffset;
      const timestamp = new Date(vodStart + (node.contentOffsetSeconds || 0) * 1000);

      // Donations
      if (username === botName && config.sourcesEnabled.donation) {
        const parsed = parseDonationMessage(message);
        if (parsed) {
          const amountVal = parseAmount(parsed.amount);
          if (amountVal >= config.minDonation) {
            const local = tryLocalMatch(parsed.message);
            const req: Request = {
              id: hashStringToNumber(`vod:${node.id}`),
              timestamp,
              donor: parsed.donor,
              amount: parsed.amount,
              amountVal,
              message: parsed.message,
              character: local?.character || '',
              type: local?.type || 'unknown',
              source: 'donation',
              needsIdentification: !local
            };
            requests.push(req);
            callbacks?.onRequest?.(req);
          }
        }
      }

      // Chat commands
      if (username !== botName && message.toLowerCase().startsWith(chatCommand) && config.sourcesEnabled.chat) {
        const requestText = message.slice(chatCommand.length).trim();
        if (requestText) {
          const local = tryLocalMatch(requestText);
          const req: Request = {
            id: hashStringToNumber(`vod:${node.id}`),
            timestamp,
            donor: displayName,
            amount: '',
            amountVal: 0,
            message: requestText,
            character: local?.character || '',
            type: local?.type || 'unknown',
            source: 'chat',
            needsIdentification: !local
          };
          requests.push(req);
          callbacks?.onRequest?.(req);
        }
      }
    }

    callbacks?.onProgress?.(`${seen.size} msgs, ${requests.length} pedidos`);
    if (!newCount) break;
    offset = lastOffset + 1;
  }

  return requests;
}
```

Note: character is set to `''` (not `'Identificando...'`) for unresolved — these show as "Desconhecido" in the review dialog. LLM runs only after user confirms import, via the queue's existing `needsIdentification` handler (`App.tsx:177-189`).

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services/vod.ts
git commit -m "feat: add scanVODForRequests for past VOD recovery"
```

## Chunk 2: VOD Selection Dialog

### Task 3: Create VODSelectionDialog component

**Files:**
- Create: `apps/web/src/components/VODSelectionDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useCallback } from 'react';
import { fetchRecentVods, type VODInfo } from '../services/vod';

interface Props {
  isOpen: boolean;
  channel: string;
  onConfirm: (vods: VODInfo[]) => void;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function VODSelectionDialog({ isOpen, channel, onConfirm, onClose }: Props) {
  const [vods, setVods] = useState<VODInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadVods = useCallback(async (append = false) => {
    const isMore = append && cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetchRecentVods(channel, 10, isMore ? cursor! : undefined);
      setVods(prev => append ? [...prev, ...result.vods] : result.vods);
      setHasMore(result.hasMore);
      setCursor(result.endCursor);
      setLoaded(true);
    } catch {
      setError('Erro ao buscar VODs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [channel, cursor]);

  // Load on first open
  const handleOpen = useCallback(() => {
    if (!loaded) loadVods();
  }, [loaded, loadVods]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedVods = vods.filter(v => selected.has(v.id));
    onConfirm(selectedVods);
  };

  const handleClose = () => {
    setVods([]);
    setSelected(new Set());
    setCursor(null);
    setLoaded(false);
    setHasMore(false);
    onClose();
  };

  if (!isOpen) return null;

  // Trigger load on render (if not loaded)
  if (!loaded && !loading && !error) {
    handleOpen();
  }

  return (
    <div className="missed-requests-overlay" onClick={handleClose}>
      <div className="missed-requests-dialog" onClick={e => e.stopPropagation()}>
        <div className="missed-requests-header">
          <div className="missed-requests-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            Selecionar VODs
          </div>
          <button className="modal-close" onClick={handleClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="missed-requests-loading">
            <div className="missed-requests-spinner" />
            <span>Buscando VODs de {channel}...</span>
          </div>
        ) : error ? (
          <div className="missed-requests-empty">
            <span>{error}</span>
            <button className="btn btn-ghost" onClick={() => loadVods()}>Tentar novamente</button>
          </div>
        ) : vods.length === 0 ? (
          <div className="missed-requests-empty">
            <span>Nenhuma VOD encontrada para {channel}.</span>
            <button className="btn btn-ghost" onClick={handleClose}>Fechar</button>
          </div>
        ) : (
          <>
            <div className="missed-requests-subtitle">
              Selecione as VODs para buscar pedidos
            </div>
            <div className="missed-requests-list">
              {vods.map(vod => (
                <label key={vod.id} className={`missed-request-item${selected.has(vod.id) ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(vod.id)}
                    onChange={() => toggle(vod.id)}
                  />
                  <div className="missed-request-info">
                    <div className="vod-item-title">{vod.title || `VOD ${vod.id}`}</div>
                    <div className="vod-item-meta">
                      {formatDate(vod.createdAt)} · {formatDuration(vod.lengthSeconds)}
                    </div>
                  </div>
                </label>
              ))}
              {hasMore && (
                <button
                  className="btn btn-ghost vod-load-more"
                  onClick={() => loadVods(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <><span className="missed-requests-spinner-inline" /> Carregando...</>
                  ) : (
                    'Carregar mais'
                  )}
                </button>
              )}
            </div>
            <div className="missed-requests-footer">
              <button className="btn btn-ghost" onClick={handleClose}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={selected.size === 0}
              >
                Buscar pedidos {selected.size > 0 ? `(${selected.size} VOD${selected.size > 1 ? 's' : ''})` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS for VOD-specific elements**

Append to `apps/web/src/styles/missed-requests.css`:

```css
/* VOD Selection */
.vod-item-title {
  font-size: var(--text-sm);
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vod-item-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.vod-load-more {
  width: 100%;
  justify-content: center;
  padding: 0.75rem;
  border-top: 1px solid var(--border);
  border-radius: 0;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/VODSelectionDialog.tsx apps/web/src/styles/missed-requests.css
git commit -m "feat: add VODSelectionDialog component"
```

## Chunk 3: Extend MissedRequestsDialog with disabledIds

### Task 4: Add disabledIds prop to MissedRequestsDialog

**Files:**
- Modify: `apps/web/src/components/MissedRequestsDialog.tsx`

- [ ] **Step 1: Add disabledIds to Props interface**

Change the Props interface:

```typescript
interface Props {
  isOpen: boolean;
  requests: Request[];
  isLoading: boolean;
  loadingStatus: string;
  onConfirm: (selected: Request[]) => void;
  onClose: () => void;
  disabledIds?: Set<number>;
}
```

Update the destructuring:

```typescript
export function MissedRequestsDialog({ isOpen, requests, isLoading, loadingStatus, onConfirm, onClose, disabledIds }: Props) {
```

- [ ] **Step 2: Exclude disabled IDs from auto-select and toggleAll**

In the `useEffect` that auto-selects new requests, filter out disabled:

```typescript
useEffect(() => {
  const newIds = requests.filter(r => !seenIds.current.has(r.id) && !disabledIds?.has(r.id)).map(r => r.id);
  if (!newIds.length) return;
  for (const id of newIds) seenIds.current.add(id);
  setSelected(prev => { const next = new Set(prev); for (const id of newIds) next.add(id); return next; });
}, [requests, disabledIds]);
```

Update `toggleAll`:

```typescript
const selectableRequests = requests.filter(r => !disabledIds?.has(r.id));

const toggleAll = (selectAll: boolean) => {
  if (selectAll) {
    setSelected(new Set(selectableRequests.map(r => r.id)));
  } else {
    setSelected(new Set());
  }
};
```

Update `allSelected` and count calculations to use `selectableRequests`:

```typescript
const allSelected = selected.size === selectableRequests.length && selectableRequests.length > 0;
```

- [ ] **Step 3: Render disabled rows with greyed-out style**

In the `requests.map()` render, add disabled state:

```tsx
const isDisabled = disabledIds?.has(req.id);

return (
  <label key={req.id} className={`missed-request-item${selected.has(req.id) ? ' checked' : ''}${isDisabled ? ' disabled' : ''}`}>
    <input
      type="checkbox"
      checked={selected.has(req.id)}
      onChange={() => toggle(req.id)}
      disabled={isDisabled}
    />
    {/* ...rest unchanged... */}
    {isDisabled && (
      <span className="missed-request-duplicate" title="Já na fila">
        Já na fila
      </span>
    )}
  </label>
);
```

- [ ] **Step 4: Add disabled CSS**

Append to `apps/web/src/styles/missed-requests.css`:

```css
/* Disabled/duplicate rows */
.missed-request-item.disabled {
  opacity: 0.4;
  cursor: default;
  pointer-events: none;
}

.missed-request-duplicate {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
}
```

- [ ] **Step 5: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/MissedRequestsDialog.tsx apps/web/src/styles/missed-requests.css
git commit -m "feat: add disabledIds prop to MissedRequestsDialog"
```

## Chunk 4: RecoverRequestsCard + Wiring in App.tsx

### Task 5: Add RecoverRequestsCard to SourcesPanel

**Files:**
- Modify: `apps/web/src/components/SourcesPanel.tsx`

- [ ] **Step 1: Add recover section**

Add a prop for the callback and render a new card after the source sections grid. Add `onRecover` prop:

```typescript
interface SourcesPanelProps {
  onRecover?: () => void;
}

export function SourcesPanel({ onRecover }: SourcesPanelProps) {
```

Add the card after the priority section (before closing `</div>` of `sources-panel-body`):

```tsx
{onRecover && !readOnly && (
  <div className="recover-section">
    <button className="btn btn-ghost recover-btn" onClick={onRecover}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
      Recuperar pedidos de VODs anteriores
    </button>
  </div>
)}
```

- [ ] **Step 2: Add CSS for recover section**

Append to `apps/web/src/styles/sources-panel.css`:

```css
/* Recover section */
.recover-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--border);
}

.recover-btn {
  width: 100%;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.recover-btn:hover {
  color: var(--text);
}

.recover-btn svg {
  color: var(--accent);
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SourcesPanel.tsx apps/web/src/styles/sources-panel.css
git commit -m "feat: add recover requests button to SourcesPanel"
```

### Task 6: Wire everything together in App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add imports**

Add to existing imports:

```typescript
import { VODSelectionDialog } from './components/VODSelectionDialog';
import { scanVODForRequests, type VODInfo } from './services/vod';
```

Add `useMemo` to the React import (line 1):

```typescript
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
```

- [ ] **Step 2: Add VOD recovery state**

Add after the existing missed requests recovery state block (~line 54):

```typescript
// VOD recovery (past VODs) state
const [vodSelectOpen, setVodSelectOpen] = useState(false);
const [vodRecoveryOpen, setVodRecoveryOpen] = useState(false);
const [vodRecoveryLoading, setVodRecoveryLoading] = useState(false);
const [vodRecoveryStatus, setVodRecoveryStatus] = useState('');
const [vodRecoveredRequests, setVodRecoveredRequests] = useState<Request[]>([]);
const vodRecoveryAbort = useRef<AbortController | null>(null);
```

- [ ] **Step 3: Add VOD scan handler**

```typescript
const handleVodSelect = useCallback(async (vods: VODInfo[]) => {
  setVodSelectOpen(false);
  setVodRecoveredRequests([]);
  setVodRecoveryLoading(true);
  setVodRecoveryOpen(true);

  const sourcesState = useSources.getState();
  const config = {
    botName: donateBotName,
    minDonation: sourcesState.minDonation,
    sourcesEnabled: sourcesState.enabled,
    chatCommand: sourcesState.chatCommand
  };

  const controller = new AbortController();
  vodRecoveryAbort.current = controller;

  try {
    for (const vod of vods) {
      if (controller.signal.aborted) break;
      setVodRecoveryStatus(`Analisando VOD "${vod.title || vod.id}"...`);
      await scanVODForRequests(vod.id, vod.createdAt, config, {
        onProgress: (s) => setVodRecoveryStatus(`VOD "${vod.title || vod.id}": ${s}`),
        onRequest: (req) => setVodRecoveredRequests(prev => [...prev, req])
      }, controller.signal);
    }
  } catch (err) {
    if (!controller.signal.aborted) console.error('VOD scan failed:', err);
  } finally {
    setVodRecoveryLoading(false);
    vodRecoveryAbort.current = null;
  }
}, [useSources]);

const vodDisabledIds = useMemo(
  () => new Set(requests.map(r => r.id)),
  [requests]
);

const handleVodRecoveryConfirm = useCallback((selected: Request[]) => {
  if (selected.length === 0) { setVodRecoveryOpen(false); return; }

  const currentRequests = useRequests.getState().requests;
  const { sortMode: currentSortMode, priority: currentPriority } = useSources.getState();
  const existingIds = new Set(currentRequests.map(r => r.id));
  const deduped = selected.filter(r => !existingIds.has(r.id));

  if (deduped.length === 0) { setVodRecoveryOpen(false); return; }

  const merged = [...currentRequests, ...deduped];
  if (currentSortMode === 'fifo') {
    merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } else {
    merged.sort((a, b) => {
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;
      const aPri = currentPriority.indexOf(a.source);
      const bPri = currentPriority.indexOf(b.source);
      if (aPri !== bPri) return aPri - bPri;
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  setAll(merged);
  setVodRecoveryOpen(false);
  show(
    `${deduped.length} pedido${deduped.length !== 1 ? 's' : ''} recuperado${deduped.length !== 1 ? 's' : ''} de VODs`,
    'Pedidos recuperados'
  );
}, [useRequests, useSources, setAll, show]);

const handleVodRecoveryClose = useCallback(() => {
  vodRecoveryAbort.current?.abort();
  setVodRecoveryOpen(false);
}, []);
```

- [ ] **Step 4: Pass onRecover to SourcesPanel**

Change line `{!readOnly && <SourcesPanel />}` to:

```tsx
{!readOnly && <SourcesPanel onRecover={() => setVodSelectOpen(true)} />}
```

- [ ] **Step 5: Add dialogs to JSX**

Add after the existing `<MissedRequestsDialog>`:

```tsx
<VODSelectionDialog
  isOpen={vodSelectOpen}
  channel={channel}
  onConfirm={handleVodSelect}
  onClose={() => setVodSelectOpen(false)}
/>
<MissedRequestsDialog
  isOpen={vodRecoveryOpen}
  requests={vodRecoveredRequests}
  isLoading={vodRecoveryLoading}
  loadingStatus={vodRecoveryStatus}
  onConfirm={handleVodRecoveryConfirm}
  onClose={handleVodRecoveryClose}
  disabledIds={vodDisabledIds}
/>
```

- [ ] **Step 6: Verify it compiles**

Run: `cd apps/web && bunx tsc --noEmit`

- [ ] **Step 7: Manual test**

Run `bun run dev`, open a channel page, open the sources panel, click "Recuperar pedidos de VODs anteriores". Verify:
1. VOD selection dialog opens with list of recent VODs
2. Can select VODs and click "Buscar pedidos"
3. MissedRequestsDialog opens with progressive results
4. Any requests already in queue show as disabled/greyed
5. Confirming imports requests into the queue
6. LLM identification runs for unresolved characters after import

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: wire VOD recovery flow — select VODs, scan, review, import"
```
