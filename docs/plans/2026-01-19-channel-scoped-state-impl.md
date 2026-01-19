# Channel-Scoped State Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make requests and sources config per-channel using store factories and React context.

**Architecture:** Store factories create zustand stores with channel-prefixed localStorage keys. ChannelProvider wraps app when channel is active. twitch.ts receives store refs via setActiveStores().

**Tech Stack:** React, Zustand, TypeScript

---

### Task 1: Create migration utility

**Files:**
- Create: `apps/web/src/utils/migrate.ts`

**Step 1: Create migration file**

```ts
// apps/web/src/utils/migrate.ts
export function migrateGlobalToChannel(): string | null {
  const oldSettings = localStorage.getItem('dbd-settings');
  if (!oldSettings) return null;

  let state: { channel?: string };
  try {
    state = JSON.parse(oldSettings).state;
  } catch {
    return null;
  }

  const channel = state.channel?.toLowerCase();
  if (!channel) return null;

  // Skip if already migrated
  if (localStorage.getItem(`dbd-requests-${channel}`)) return channel;

  console.log(`Migrating global state to channel: ${channel}`);

  // Migrate requests
  const oldRequests = localStorage.getItem('dbd-requests');
  if (oldRequests) {
    localStorage.setItem(`dbd-requests-${channel}`, oldRequests);
    localStorage.removeItem('dbd-requests');
  }

  // Migrate sources
  const oldSources = localStorage.getItem('dbd-sources');
  if (oldSources) {
    localStorage.setItem(`dbd-sources-${channel}`, oldSources);
    localStorage.removeItem('dbd-sources');
  }

  return channel;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/utils/migrate.ts
git commit -m "feat: add migration utility for channel-scoped state"
```

---

### Task 2: Create store factories

**Files:**
- Create: `apps/web/src/store/channel.ts`
- Modify: `apps/web/src/store/requests.ts` - extract store creation logic
- Modify: `apps/web/src/store/sources.ts` - extract store creation logic

**Step 1: Create channel.ts with factory functions**

```ts
// apps/web/src/store/channel.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Request } from '../types';
import type { SourcesEnabled } from '../types';

// ============ REQUESTS STORE ============

interface RequestsStore {
  requests: Request[];
  add: (req: Request) => void;
  update: (id: number, updates: Partial<Request>) => void;
  toggleDone: (id: number) => void;
  setAll: (requests: Request[]) => void;
  reorder: (fromId: number, toId: number) => void;
}

export type RequestsStoreApi = ReturnType<typeof createRequestsStore>;

export function createRequestsStore(channel: string, getSourcesState: () => SourcesStore) {
  return create<RequestsStore>()(
    persist(
      (set) => ({
        requests: [],
        add: (req) => set((s) => {
          const { sortMode, priority } = getSourcesState();
          if (sortMode === 'fifo') {
            return { requests: [...s.requests, req] };
          }
          const requests = [...s.requests];
          const reqPri = priority.indexOf(req.source);
          let insertIdx = requests.length;
          for (let i = 0; i < requests.length; i++) {
            if (requests[i].done) continue;
            const iPri = priority.indexOf(requests[i].source);
            if (iPri > reqPri || (iPri === reqPri && requests[i].timestamp > req.timestamp)) {
              insertIdx = i;
              break;
            }
          }
          requests.splice(insertIdx, 0, req);
          return { requests };
        }),
        update: (id, updates) => set((s) => ({
          requests: s.requests.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
        toggleDone: (id) => set((s) => ({
          requests: s.requests.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
        })),
        setAll: (requests) => set({ requests }),
        reorder: (fromId, toId) => set((s) => {
          const requests = [...s.requests];
          const fromIdx = requests.findIndex(r => r.id === fromId);
          const toIdx = requests.findIndex(r => r.id === toId);
          if (fromIdx === -1 || toIdx === -1) return s;
          const [moved] = requests.splice(fromIdx, 1);
          requests.splice(toIdx, 0, moved);
          return { requests };
        }),
      }),
      {
        name: `dbd-requests-${channel}`,
        partialize: (state) => ({ requests: state.requests }),
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const parsed = JSON.parse(str);
            return {
              state: {
                ...parsed.state,
                requests: (parsed.state.requests || []).map((r: any) => ({
                  ...r,
                  timestamp: new Date(r.timestamp),
                })),
              },
            };
          },
          setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    )
  );
}

// ============ SOURCES STORE ============

type SourceType = 'donation' | 'resub' | 'chat' | 'manual';
type SortMode = 'priority' | 'fifo';

interface SourcesStore {
  enabled: SourcesEnabled;
  chatCommand: string;
  chatTiers: number[];
  priority: SourceType[];
  sortMode: SortMode;
  minDonation: number;
  setEnabled: (enabled: SourcesEnabled) => void;
  toggleSource: (source: keyof SourcesEnabled) => void;
  setChatCommand: (cmd: string) => void;
  setChatTiers: (tiers: number[]) => void;
  setPriority: (priority: SourceType[]) => void;
  setSortMode: (mode: SortMode) => void;
  setMinDonation: (min: number) => void;
}

export type SourcesStoreApi = ReturnType<typeof createSourcesStore>;

export const SOURCES_DEFAULTS = {
  enabled: {
    donation: true,
    chat: true,
    resub: false,
    manual: true,
  },
  chatCommand: '!fila',
  chatTiers: [2, 3],
  priority: ['donation', 'chat', 'resub', 'manual'] as SourceType[],
  sortMode: 'fifo' as SortMode,
  minDonation: 5,
};

export function createSourcesStore(channel: string) {
  return create<SourcesStore>()(
    persist(
      (set) => ({
        enabled: SOURCES_DEFAULTS.enabled,
        chatCommand: SOURCES_DEFAULTS.chatCommand,
        chatTiers: SOURCES_DEFAULTS.chatTiers,
        priority: SOURCES_DEFAULTS.priority,
        sortMode: SOURCES_DEFAULTS.sortMode,
        minDonation: SOURCES_DEFAULTS.minDonation,
        setEnabled: (enabled) => set({ enabled }),
        toggleSource: (source) => set((s) => ({
          enabled: { ...s.enabled, [source]: !s.enabled[source] }
        })),
        setChatCommand: (chatCommand) => set({ chatCommand }),
        setChatTiers: (chatTiers) => set({ chatTiers }),
        setPriority: (priority) => set({ priority }),
        setSortMode: (sortMode) => set({ sortMode }),
        setMinDonation: (minDonation) => set({ minDonation }),
      }),
      { name: `dbd-sources-${channel}` }
    )
  );
}

// ============ CHANNEL STORES ============

export interface ChannelStores {
  useRequests: RequestsStoreApi;
  useSources: SourcesStoreApi;
}

export function createChannelStores(channel: string): ChannelStores {
  const key = channel.toLowerCase();
  const useSources = createSourcesStore(key);
  const useRequests = createRequestsStore(key, () => useSources.getState());
  return { useRequests, useSources };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/store/channel.ts
git commit -m "feat: add channel store factories"
```

---

### Task 3: Create ChannelContext

**Files:**
- Create: `apps/web/src/store/ChannelContext.tsx`

**Step 1: Create context file**

```tsx
// apps/web/src/store/ChannelContext.tsx
import { createContext, useContext, useMemo, useEffect } from 'react';
import { createChannelStores, type ChannelStores } from './channel';
import { setActiveStores } from '../services/twitch';

interface ChannelContextValue extends ChannelStores {
  channel: string;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

interface ChannelProviderProps {
  channel: string;
  children: React.ReactNode;
}

export function ChannelProvider({ channel, children }: ChannelProviderProps) {
  const stores = useMemo(() => createChannelStores(channel), [channel]);

  useEffect(() => {
    setActiveStores(stores);
    return () => setActiveStores(null);
  }, [stores]);

  const value = useMemo(
    () => ({ channel, ...stores }),
    [channel, stores]
  );

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel(): ChannelContextValue {
  const ctx = useContext(ChannelContext);
  if (!ctx) throw new Error('useChannel must be used inside ChannelProvider');
  return ctx;
}
```

**Step 2: Commit**

```bash
git add apps/web/src/store/ChannelContext.tsx
git commit -m "feat: add ChannelContext and provider"
```

---

### Task 4: Update twitch.ts to use injected stores

**Files:**
- Modify: `apps/web/src/services/twitch.ts`

**Step 1: Add store injection mechanism**

Replace global store imports with injected stores:

```ts
// apps/web/src/services/twitch.ts
import { tryLocalMatch } from '../data/characters';
import { parseAmount, parseDonationMessage } from '../utils/helpers';
import { useSettings, useChat } from '../store';
import type { Request } from '../types';
import type { ChannelStores } from '../store/channel';

let ws: WebSocket | null = null;
let activeStores: ChannelStores | null = null;

export function setActiveStores(stores: ChannelStores | null) {
  activeStores = stores;
}

function getStores() {
  if (!activeStores) throw new Error('No active channel stores');
  return activeStores;
}

export function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
    useSettings.getState().setStatus('disconnected', 'Desconectado');
    window.location.hash = '';
  }
}

export function connect() {
  const { channel } = useSettings.getState();
  const ch = channel.trim().toLowerCase();
  if (!ch) return;

  useSettings.getState().setStatus('connecting', 'Conectando...');

  ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
  ws.onopen = () => {
    ws!.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
    ws!.send('NICK justinfan' + Math.floor(Math.random() * 99999));
    ws!.send(`JOIN #${ch}`);
  };
  ws.onmessage = (e) => {
    for (const line of e.data.split('\r\n')) {
      if (line.startsWith('PING')) ws!.send('PONG :tmi.twitch.tv');
      else if (line.includes('366')) {
        useSettings.getState().setStatus('connected', `t.tv/${ch}`);
        window.location.hash = `/${ch}`;
      }
      else if (line.includes('USERNOTICE')) handleUserNotice(line);
      else if (line.includes('PRIVMSG')) handleMessage(line);
    }
  };
  ws.onclose = () => { useSettings.getState().setStatus('error', 'Desconectado'); ws = null; };
  ws.onerror = () => useSettings.getState().setStatus('error', 'Erro');
}

function parseIrcTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const m = raw.match(/^@([^ ]+)/);
  if (m) m[1].split(';').forEach(p => { const [k, v] = p.split('='); tags[k] = v || ''; });
  return tags;
}

function getSubTierFromBadges(badges: string): number {
  if (!badges) return 0;
  const m = badges.match(/subscriber\/(\d+)/);
  if (!m) return 0;
  const t = parseInt(m[1]);
  return t >= 3000 ? 3 : t >= 2000 ? 2 : 1;
}

export function handleUserNotice(raw: string) {
  const { useSources, useRequests } = getStores();
  const { enabled } = useSources.getState();
  const { isLLMEnabled } = useSettings.getState();
  const { add: addRequest } = useRequests.getState();
  const { add: addChat } = useChat.getState();
  const llmEnabled = isLLMEnabled();

  const tags = parseIrcTags(raw);
  if (tags['msg-id'] !== 'resub' && tags['msg-id'] !== 'sub') return;
  if (!enabled.resub) return;

  const displayName = tags['display-name'] || 'unknown';
  const msgMatch = raw.match(/USERNOTICE #\w+ :(.+)$/);
  const message = msgMatch?.[1]?.trim() || '';
  if (!message) return;

  addChat({ user: displayName, message: `[${tags['msg-id']}] ${message}`, isDonate: false, color: null });

  const local = tryLocalMatch(message);

  const request: Request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message,
    character: local?.character || (llmEnabled ? 'Identificando...' : ''),
    type: local?.type || 'unknown',
    source: 'resub',
    needsIdentification: !local && llmEnabled
  };
  addRequest(request);
}

function handleChatCommand(tags: Record<string, string>, displayName: string, _username: string, requestText: string) {
  const { useSources, useRequests } = getStores();
  const { enabled, chatTiers } = useSources.getState();
  const { isLLMEnabled } = useSettings.getState();
  const { add: addRequest } = useRequests.getState();
  const llmEnabled = isLLMEnabled();

  if (!enabled.chat || !requestText) return;

  const isSub = tags.subscriber === '1';
  const subTier = getSubTierFromBadges(tags.badges);
  if (!isSub || !chatTiers.includes(subTier)) return;

  const local = tryLocalMatch(requestText);

  const request: Request = {
    id: Date.now() + Math.random(),
    timestamp: new Date(),
    donor: displayName,
    amount: '',
    amountVal: 0,
    message: requestText,
    character: local?.character || (llmEnabled ? 'Identificando...' : ''),
    type: local?.type || 'unknown',
    source: 'chat',
    subTier,
    needsIdentification: !local && llmEnabled
  };
  addRequest(request);
}

export function handleMessage(raw: string) {
  const { useSources, useRequests } = getStores();
  const { botName, isLLMEnabled } = useSettings.getState();
  const { enabled, chatCommand, minDonation } = useSources.getState();
  const { add: addRequest } = useRequests.getState();
  const { add: addChat } = useChat.getState();
  const llmEnabled = isLLMEnabled();

  const tags = parseIrcTags(raw);
  const userMatch = raw.match(/display-name=([^;]*)/i);
  const msgMatch = raw.match(/PRIVMSG #\w+ :(.+)$/);
  const colorMatch = raw.match(/color=(#[0-9A-Fa-f]{6})/i);
  if (!userMatch || !msgMatch) return;

  const displayName = userMatch[1] || 'unknown';
  const username = displayName.toLowerCase();
  const message = msgMatch[1].trim();
  const color = colorMatch?.[1] || null;
  const bot = botName.toLowerCase();

  addChat({ user: displayName, message, isDonate: username === bot, color });

  if (message.toLowerCase().startsWith(chatCommand.toLowerCase())) {
    const requestText = message.slice(chatCommand.length).trim();
    if (requestText) {
      handleChatCommand(tags, displayName, username, requestText);
    }
    return;
  }

  if (username !== bot) return;
  const parsed = parseDonationMessage(message);
  if (!parsed || !enabled.donation) return;

  const amountVal = parseAmount(parsed.amount);
  if (amountVal < minDonation) return;

  const local = tryLocalMatch(parsed.message);

  const request: Request = {
    id: Date.now(),
    timestamp: new Date(),
    donor: parsed.donor,
    amount: parsed.amount,
    amountVal,
    message: parsed.message,
    character: local?.character || (llmEnabled ? 'Identificando...' : ''),
    type: local?.type || 'unknown',
    source: 'donation',
    needsIdentification: !local && llmEnabled
  };
  addRequest(request);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/services/twitch.ts
git commit -m "refactor: twitch.ts uses injected channel stores"
```

---

### Task 5: Update store/index.ts exports

**Files:**
- Modify: `apps/web/src/store/index.ts`

**Step 1: Update exports**

```ts
// apps/web/src/store/index.ts
export { useSettings } from './settings';
export { useToasts } from './toasts';
export { useChat } from './chat';
export { useAuth } from './auth';
export { ChannelProvider, useChannel } from './ChannelContext';
export { SOURCES_DEFAULTS } from './channel';
```

**Step 2: Commit**

```bash
git add apps/web/src/store/index.ts
git commit -m "refactor: update store exports for channel-scoped stores"
```

---

### Task 6: Remove channel from settings store

**Files:**
- Modify: `apps/web/src/store/settings.ts`

**Step 1: Remove channel-related code**

Remove `channel`, `setChannel` from interface and implementation. Remove from `partialize`. Keep migration code but don't migrate channel.

```ts
// apps/web/src/store/settings.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionState } from '../types';

const DEFAULTS = {
  models: ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  botName: 'livepix',
};

interface SettingsState {
  apiKey: string | null;
  models: string[];
  botName: string;
  status: ConnectionState;
  statusText: string;
  chatHidden: boolean;
  isLLMEnabled: () => boolean;
  setApiKey: (key: string | null) => void;
  setModels: (models: string[]) => void;
  setBotName: (name: string) => void;
  setStatus: (status: ConnectionState, text: string) => void;
  setChatHidden: (hidden: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      models: DEFAULTS.models,
      botName: DEFAULTS.botName,
      status: 'disconnected',
      statusText: 'Desconectado',
      chatHidden: true,
      isLLMEnabled: () => !!get().apiKey,
      setApiKey: (apiKey) => set({ apiKey: apiKey?.trim() || null }),
      setModels: (models) => set({ models }),
      setBotName: (botName) => set({ botName: botName.trim() || 'livepix' }),
      setStatus: (status, statusText) => set({ status, statusText }),
      setChatHidden: (chatHidden) => set({ chatHidden }),
    }),
    {
      name: 'dbd-settings',
      partialize: (state) => ({
        apiKey: state.apiKey,
        models: state.models,
        botName: state.botName,
        chatHidden: state.chatHidden,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (str) return JSON.parse(str);

          // Migrate from legacy keys
          const legacyKeys = ['gemini_key', 'gemini_models', 'dbd_bot_name'];
          if (!legacyKeys.some(k => localStorage.getItem(k))) return null;

          console.log('Migrating legacy settings');
          const state = {
            apiKey: localStorage.getItem('gemini_key') || null,
            models: JSON.parse(localStorage.getItem('gemini_models') || 'null') || DEFAULTS.models,
            botName: localStorage.getItem('dbd_bot_name') || DEFAULTS.botName,
            chatHidden: true,
          };
          legacyKeys.forEach(k => localStorage.removeItem(k));
          return { state };
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
```

**Step 2: Commit**

```bash
git add apps/web/src/store/settings.ts
git commit -m "refactor: remove channel from settings (now from URL)"
```

---

### Task 7: Update App.tsx with migration and ChannelProvider

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Refactor App.tsx**

```tsx
// apps/web/src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import { ChatLog } from './components/ChatLog';
import { ControlPanel } from './components/ControlPanel';
import { DebugPanel } from './components/DebugPanel';
import { CharacterRequestList } from './components/CharacterRequestList';
import { ManualEntry } from './components/ManualEntry';
import { SettingsModal } from './components/SettingsModal';
import { SourcesPanel } from './components/SourcesPanel';
import { Stats } from './components/Stats';
import { ToastContainer } from './components/ToastContainer';
import { connect, disconnect, identifyCharacter } from './services';
import { useSettings, useAuth, ChannelProvider, useChannel } from './store';
import { migrateGlobalToChannel } from './utils/migrate';

const getChannelFromHash = (hash: string) => hash.replace(/^#\/?/, '') || null;

function ChannelApp() {
  const { useRequests, useSources } = useChannel();
  const requests = useRequests((s) => s.requests);
  const update = useRequests((s) => s.update);
  const { apiKey, models, botName, chatHidden, setChatHidden } = useSettings();
  const sortMode = useSources((s) => s.sortMode);
  const setSortMode = useSources((s) => s.setSortMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize existing requests so they don't trigger toasts on load
  useEffect(() => {
    if (!isInitialized && requests.length > 0) {
      const pendingNotification = requests.filter(r => !r.toastShown && !r.needsIdentification);
      for (const req of pendingNotification) {
        update(req.id, { toastShown: true });
      }
      setIsInitialized(true);
    } else if (!isInitialized && requests.length === 0) {
      setIsInitialized(true);
    }
  }, [requests, update, isInitialized]);

  // Auto-identify requests that need it
  useEffect(() => {
    const pending = requests.filter(r => r.needsIdentification);
    for (const req of pending) {
      identifyCharacter(
        req,
        { apiKey, models },
        undefined,
        (llmResult) => update(req.id, llmResult)
      ).then(result => {
        update(req.id, { ...result, needsIdentification: false });
      });
    }
  }, [requests, apiKey, models, update]);

  // Handle toasts for ready requests
  useEffect(() => {
    if (!isInitialized) return;

    const { show } = await import('./store/toasts').then(m => m.useToasts.getState());
    const readyToToast = requests.filter(r => !r.toastShown && !r.needsIdentification);
    for (const req of readyToToast) {
      const title = req.source === 'manual' ? 'Novo pedido' :
        req.source === 'donation' ? 'Novo pedido por donate' :
          req.source === 'resub' ? 'Novo pedido por resub' : 'Novo pedido pelo chat';

      const message = req.character
        ? `${req.donor} pediu ${req.character}${req.amount ? ` (${req.amount})` : ''}`
        : `Novo pedido de ${req.donor}${req.amount ? ` (${req.amount})` : ''}`;

      show(message, title);
      update(req.id, { toastShown: true });
    }
  }, [requests, update, isInitialized]);

  const pendingCount = requests.filter(d => !d.done).length;

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <img src={`${import.meta.env.BASE_URL}images/Dead-by-Daylight-Emblem.png`} alt="DBD" />
            </div>
            <h1>DBD Tracker<span>Fila de pedidos</span></h1>
          </div>
          <Stats />
        </header>

        <ControlPanel onOpenSettings={() => setSettingsOpen(true)} />

        <main className={`grid${chatHidden ? ' chat-hidden' : ''}`}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <img src={`${import.meta.env.BASE_URL}images/IconPlayers.webp`} />
                Fila
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => setSortMode(sortMode === 'fifo' ? 'priority' : 'fifo')}
                  title={`${sortMode === 'fifo' ? 'Novos pedidos entram no final' : 'Novos pedidos entram por prioridade de fonte'}. Clique para alternar.`}
                >
                  {sortMode === 'fifo' ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M3 12h12M3 18h6" />
                    </svg>
                  )}
                  Ordem: {sortMode === 'fifo' ? 'chegada' : 'prioridade'}
                </button>
                <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setManualOpen(true)} title="Adicionar novo pedido">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button className={`btn btn-ghost btn-small btn-small-icon${showDone ? ' active' : ''}`} onClick={() => setShowDone(v => !v)} title={showDone ? 'Esconder feitos' : 'Mostrar feitos'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showDone ? <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /> : <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />}
                    <circle cx="12" cy="12" r="3" style={{ display: showDone ? 'block' : 'none' }} />
                    {!showDone && <line x1="1" y1="1" x2="23" y2="23" />}
                  </svg>
                </button>
                {chatHidden && (
                  <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setChatHidden(false)} title="Mostrar chat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </button>
                )}
                <span className="panel-count">{pendingCount}</span>
              </div>
            </div>
            <div className="panel-body">
              <CharacterRequestList showDone={showDone} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                Chat ao Vivo
              </div>
              <button className="btn btn-ghost btn-small btn-small-icon" onClick={() => setChatHidden(true)} title="Esconder chat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="panel-body chat-body">
              <ChatLog />
            </div>
          </div>
        </main>

        <SourcesPanel />
        {window.location.hash.includes('debug') && <DebugPanel />}

        <footer className="footer">
          <div>Monitorando doações via <strong style={{ color: 'var(--accent)' }}>{botName}</strong></div>
          <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Versão: {__APP_VERSION__}</span>
            <span className="footer-separator">•</span>
            <a href="https://github.com/macecchi/dbd-utils" target="_blank">GitHub</a>
          </span>
        </footer>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ManualEntry isOpen={manualOpen} onClose={() => setManualOpen(false)} />
      <ToastContainer />
    </>
  );
}

export function App() {
  const { handleCallback } = useAuth();
  const [channel, setChannel] = useState<string | null>(null);

  // Handle OAuth callback and migration on mount
  useEffect(() => {
    // Run migration first
    const migratedChannel = migrateGlobalToChannel();

    // Handle OAuth callback
    const success = handleCallback();
    if (success) {
      const freshUser = useAuth.getState().user;
      if (freshUser?.login) {
        window.location.hash = `#/${freshUser.login}`;
        setChannel(freshUser.login.toLowerCase());
        return;
      }
    }

    // Set channel from hash or migration
    const hashChannel = getChannelFromHash(window.location.hash);
    if (hashChannel) {
      setChannel(hashChannel.toLowerCase());
    } else if (migratedChannel) {
      window.location.hash = `#/${migratedChannel}`;
      setChannel(migratedChannel);
    }
  }, [handleCallback]);

  // Handle hashchange
  useEffect(() => {
    const onHashChange = () => {
      const hashChannel = getChannelFromHash(window.location.hash);
      if (hashChannel) {
        setChannel(hashChannel.toLowerCase());
        connect();
      } else {
        setChannel(null);
        disconnect();
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Connect when channel is set
  useEffect(() => {
    if (channel) {
      connect();
    }
  }, [channel]);

  if (!channel) {
    // TODO: Landing page - for now just show connect UI
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            <div className="brand-icon">
              <img src={`${import.meta.env.BASE_URL}images/Dead-by-Daylight-Emblem.png`} alt="DBD" />
            </div>
            <h1>DBD Tracker<span>Fila de pedidos</span></h1>
          </div>
        </header>
        <ControlPanel onOpenSettings={() => {}} />
        <ToastContainer />
      </div>
    );
  }

  return (
    <ChannelProvider channel={channel}>
      <ChannelApp />
    </ChannelProvider>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "refactor: App uses ChannelProvider and migration"
```

---

### Task 8: Update components to use useChannel

**Files:**
- Modify: `apps/web/src/components/CharacterRequestList.tsx`
- Modify: `apps/web/src/components/SourcesPanel.tsx`
- Modify: `apps/web/src/components/Stats.tsx`
- Modify: `apps/web/src/components/ManualEntry.tsx`
- Modify: `apps/web/src/components/DebugPanel.tsx`

**Step 1: Update CharacterRequestList.tsx**

Replace `import { useRequests } from '../store'` with `import { useChannel } from '../store'` and use `const { useRequests } = useChannel()`.

```tsx
// CharacterRequestList.tsx - key changes
import { useChannel, useSettings, useToasts } from '../store';
// ...
export function CharacterRequestList({ showDone = false }: Props) {
  const { useRequests } = useChannel();
  const { requests, toggleDone, update, reorder } = useRequests();
  // ... rest unchanged
}
```

**Step 2: Update SourcesPanel.tsx**

```tsx
// SourcesPanel.tsx - key changes
import { useChannel, useSettings, SOURCES_DEFAULTS } from '../store';
// ...
export function SourcesPanel() {
  const { useSources } = useChannel();
  const {
    enabled, chatCommand, chatTiers, priority, sortMode, minDonation,
    setEnabled, setChatCommand, setChatTiers, setPriority, setMinDonation
  } = useSources();
  const { botName, setBotName } = useSettings();
  // ... rest unchanged, but use SOURCES_DEFAULTS instead of DEFAULTS
}
```

**Step 3: Update Stats.tsx**

```tsx
// Stats.tsx - full file
import { useChannel } from '../store';

export function Stats() {
  const { useRequests } = useChannel();
  const requests = useRequests((s) => s.requests);
  const pending = requests.filter(d => !d.done);
  const survivorCount = pending.filter(d => d.type === 'survivor').length;
  const killerCount = pending.filter(d => d.type === 'killer').length;

  return (
    <div className="stats">
      <div className="stat">
        <div className="stat-value">{survivorCount}</div>
        <div className="stat-label">Survs</div>
      </div>
      <div className="stat">
        <div className="stat-value">{killerCount}</div>
        <div className="stat-label">Killers</div>
      </div>
    </div>
  );
}
```

**Step 4: Update ManualEntry.tsx**

```tsx
// ManualEntry.tsx - key changes
import { useChannel } from '../store';
// ...
export function ManualEntry({ isOpen, onClose }: Props) {
  const { useRequests } = useChannel();
  const addRequest = useRequests((s) => s.add);
  // ... rest unchanged
}
```

**Step 5: Update DebugPanel.tsx**

```tsx
// DebugPanel.tsx - key changes
import { useChannel, useSettings, useChat, useToasts, SOURCES_DEFAULTS } from '../store';
// ...
export function DebugPanel() {
  const { useRequests, useSources } = useChannel();
  const { requests, update, setAll: setRequests, add: addRequest } = useRequests();
  const { enabled: sourcesEnabled, chatTiers, chatCommand, minDonation } = useSources();
  // ... rest mostly unchanged
}
```

**Step 6: Commit**

```bash
git add apps/web/src/components/CharacterRequestList.tsx apps/web/src/components/SourcesPanel.tsx apps/web/src/components/Stats.tsx apps/web/src/components/ManualEntry.tsx apps/web/src/components/DebugPanel.tsx
git commit -m "refactor: components use useChannel for channel-scoped stores"
```

---

### Task 9: Delete old store files

**Files:**
- Delete: `apps/web/src/store/requests.ts`
- Delete: `apps/web/src/store/sources.ts`

**Step 1: Delete files**

```bash
rm apps/web/src/store/requests.ts apps/web/src/store/sources.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove old global requests/sources stores"
```

---

### Task 10: Test and verify

**Step 1: Run dev server**

```bash
cd apps/web && bun run dev
```

**Step 2: Manual test checklist**

- [ ] Visit `/` with existing localStorage data → should redirect to `#/{channel}`
- [ ] Requests show up for the migrated channel
- [ ] Sources config preserved for migrated channel
- [ ] Visit different channel hash → empty state
- [ ] Add request → persists to `dbd-requests-{channel}`
- [ ] Change source config → persists to `dbd-sources-{channel}`
- [ ] Login → redirects to user's channel with fresh state

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: ..."
```
