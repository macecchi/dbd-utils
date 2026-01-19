# Channel-Scoped State Design

## Goal

Make requests and source config per-channel. When viewing channel A, see A's data. When logged in as B, see B's data.

## What's Per-Channel vs Global

| Per-channel | Global |
|-------------|--------|
| requests | settings (LLM key, models, botName) |
| sources (enabled, chatCommand, tiers, priority, minDonation) | auth |
| | chat, toasts |

## localStorage Keys

**Before:** `dbd-requests`, `dbd-sources` (global)

**After:** `dbd-requests-{channel}`, `dbd-sources-{channel}` (channel lowercase)

## Implementation

### 1. Store Factory (`store/channel.ts`)

```ts
function createRequestsStore(channel: string) {
  return create<RequestsStore>()(
    persist(..., { name: `dbd-requests-${channel}` })
  );
}

function createSourcesStore(channel: string) {
  return create<SourcesStore>()(
    persist(..., { name: `dbd-sources-${channel}` })
  );
}

export function createChannelStores(channel: string) {
  const key = channel.toLowerCase();
  return {
    requests: createRequestsStore(key),
    sources: createSourcesStore(key),
  };
}
```

### 2. Channel Context (`store/ChannelContext.tsx`)

```tsx
const ChannelContext = createContext<{
  channel: string;
  useRequests: ReturnType<typeof createRequestsStore>;
  useSources: ReturnType<typeof createSourcesStore>;
} | null>(null);

export function ChannelProvider({ channel, children }) {
  const stores = useMemo(() => createChannelStores(channel), [channel]);
  return (
    <ChannelContext.Provider value={{ channel, ...stores }}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  const ctx = useContext(ChannelContext);
  if (!ctx) throw new Error('useChannel must be inside ChannelProvider');
  return ctx;
}
```

### 3. Migration (`utils/migrate.ts`)

On app load, before routing:

```ts
export function migrateGlobalToChannel(): string | null {
  const oldSettings = localStorage.getItem('dbd-settings');
  if (!oldSettings) return null;

  const { state } = JSON.parse(oldSettings);
  const channel = state.channel?.toLowerCase();
  if (!channel) return null;

  // Skip if already migrated
  if (localStorage.getItem(`dbd-requests-${channel}`)) return channel;

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

### 4. App Structure

```tsx
function App() {
  const [channel, setChannel] = useState<string | null>(null);

  useEffect(() => {
    const migrated = migrateGlobalToChannel();
    if (migrated && !window.location.hash) {
      window.location.hash = `#/${migrated}`;
    }
    setChannel(getChannelFromHash(window.location.hash));
  }, []);

  if (!channel) return <LandingPage />;

  return (
    <ChannelProvider channel={channel}>
      <ChannelApp />
    </ChannelProvider>
  );
}
```

## Files to Change

1. **New:** `store/channel.ts` - factory functions
2. **New:** `store/ChannelContext.tsx` - context provider
3. **New:** `utils/migrate.ts` - migration logic
4. **Modify:** `store/requests.ts` - extract to factory, remove persist key
5. **Modify:** `store/sources.ts` - extract to factory, remove persist key
6. **Modify:** `store/settings.ts` - remove `channel` from state (comes from URL now)
7. **Modify:** `App.tsx` - add migration, ChannelProvider wrapper, split to ChannelApp
8. **Modify:** All components using `useRequests`/`useSources` - use `useChannel()` instead

## Migration Flow

1. User visits `/` (no hash)
2. App checks `dbd-settings` for stored channel
3. If found, migrate `dbd-requests` → `dbd-requests-{channel}`, same for sources
4. Redirect to `#/{channel}`
5. ChannelProvider creates stores for that channel
6. Zustand rehydrates from new prefixed keys
