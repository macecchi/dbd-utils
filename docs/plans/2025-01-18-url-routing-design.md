# URL Routing & "Criar minha fila" Design

## Overview

Add hash-based URL routing and streamlined queue creation flow.

## URL Format

`/#/channelname` (e.g., `/#/mandymess`)

## Behavior

### App Load
- Parse hash → if `/#/channel`, auto-connect
- No hash → empty state

### "Criar minha fila" Button
Replaces current "Login" button.

**Logged out:** Triggers Twitch OAuth → callback auto-connects to user's channel → updates hash

**Logged in:** Connects to `user.login` → updates hash

### Manual Connect
- User types channel + clicks "Conectar"
- Updates hash to `/#/channel`

### Disconnect
- Clears hash → `/`

### Browser Back/Forward
- `hashchange` event → connect/disconnect accordingly

## UI

```
Logged out:
[Channel input] [Conectar] [⚙️] [Criar minha fila] [status]

Logged in:
[Channel input] [Conectar] [⚙️] [👤 Name] [Sair] [status]
```

- "Sair" logs out but does NOT disconnect
- Logged-in user can still connect to any channel via input

## Implementation

### Files to Modify

1. **`src/App.tsx`**
   - Parse hash on mount → auto-connect if channel present
   - Listen to `hashchange` for back/forward
   - After OAuth callback: if just logged in, auto-connect to user's channel

2. **`src/components/ControlPanel.tsx`**
   - Rename "Login" → "Criar minha fila"
   - If logged in: connect to `user.login`
   - If logged out: trigger login flow

3. **`src/store/auth.ts`**
   - `handleCallback()` returns true on successful login (already does)
   - App.tsx uses this to trigger auto-connect

4. **`src/services/connection.ts`**
   - `connect()` updates `window.location.hash`
   - `disconnect()` clears hash
