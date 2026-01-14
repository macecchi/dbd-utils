# DBD Utils

See @README.md for project overview.
Keep project docs updated when making changes.

## Structure

- `index.html` - Single page app
- `main.js` - All logic (Twitch IRC, LLM calls, UI)
- `styles.css` - Dark theme styling
- `characters.js` - DBD character data with aliases and portraits

## Key functions

- `connect()` - Twitch IRC WebSocket
- `handleMessage()` - Parse donation bot + chat commands
- `handleUserNotice()` - Parse resub USERNOTICE
- `handleChatCommand()` - Process chat requests with session limits
- `callLLM()` - Gemini API with model fallback/retry
- `identifyCharacter()` - Local match first, then LLM fallback
- `renderDonations()` - Queue UI sorted by priority + timestamp
- `loadAndReplayVOD()` - VOD chat replay via GQL
- `addManualRequest()` - Add manual character request

## Data

All state in localStorage:

- `dbd_donations` - Request queue (each has `source` field)
- `dbd_chat` - Recent chat messages
- `dbd_channel`, `dbd_bot_name`, `dbd_min_donation`
- `gemini_key`, `gemini_models`
- `dbd_sources_enabled` - {donation, resub, chat, manual}
- `dbd_chat_command` - Chat command string
- `dbd_chat_tiers` - Allowed subscriber tiers [1,2,3]
- `dbd_source_priority` - Source order for sorting
- `dbd_session_requests` - {username: timestamp} for session limits

## React Incremental Migration

When touching UI code, migrate that component to React using islands architecture.

### Setup (One-time)

```bash
bun add react react-dom
bun add -d @types/react @types/react-dom typescript
```

Add `tsconfig.json`:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true
  }
}
```

### File Structure

```
src/
  components/     # React components
  hooks/          # useDonations, useWebSocket, etc.
  store/          # Shared state bridge
  legacy/         # Original main.js (shrinks over time)
  main.tsx        # React entry point
```

### State Sharing

Use event-based store to bridge React and vanilla JS:

```ts
// src/store/donations.ts
let donations: Donation[] = [];
const listeners = new Set<() => void>();

export const donationStore = {
  get: () => donations,
  set: (newDonations: Donation[]) => {
    donations = newDonations;
    localStorage.setItem('dbd_donations', JSON.stringify(donations));
    listeners.forEach(fn => fn());
    window.dispatchEvent(new CustomEvent('donations-changed'));
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
};
(window as any).donationStore = donationStore;
```

React hook:
```tsx
import { useSyncExternalStore } from 'react';
export const useDonations = () => useSyncExternalStore(donationStore.subscribe, donationStore.get);
```

### Mounting React in Existing HTML

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { DonationList } from './components/DonationList';

const el = document.getElementById('donations');
if (el) createRoot(el).render(<DonationList />);

import './legacy/main.js'; // Keep non-migrated parts
```

### Migration Order

1. DonationCard - Self-contained, replaces innerHTML template
2. DonationList - Replaces `renderDonations()`
3. ChatLog - Replaces chat panel
4. SettingsModal - Modal HTML + logic
5. ControlPanel - Channel input, connect, status
6. SourcesPanel - Priority drag-drop, toggles

### During Migration

- Keep existing `styles.css` - components use same class names
- Expose React actions on window for onclick handlers in HTML
- Remove globals once component is fully React
- Update `bun dev` to: `bun build src/main.tsx --outdir=dist --watch`
