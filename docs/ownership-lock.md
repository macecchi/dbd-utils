# Channel Ownership Lock

Multi-tab ownership management using a lock-based pattern.

## Problem

When the same user opens the channel in multiple tabs, only one should actively manage IRC and broadcast changes. Without coordination, tabs could conflict.

## Solution

Server maintains a single `activeOwnerConnId` lock. Only the lock holder can:
- Send IRC status updates
- Broadcast queue changes
- Modify settings

## Messages

| Message | Direction | Description |
|---------|-----------|-------------|
| `claim-ownership` | Client → Server | Request the lock |
| `release-ownership` | Client → Server | Release the lock |
| `ownership-granted` | Server → Client | Lock acquired |
| `ownership-denied` | Server → Client | Lock held by another |
| `update-channel` | Server → All | Broadcast `channel.owner` state |

## Server State

```typescript
interface PartyServer {
  activeOwnerConnId: string | null;  // Connection holding the lock
  channel: {
    status: 'offline' | 'online' | 'live';
    owner: { login, displayName, avatar } | null;
  };
}
```

## Client State

```typescript
interface ChannelInfoStore {
  isOwner: boolean;           // Do I hold the lock?
  owner: ChannelOwner | null; // Who holds the lock (from server)
}

// Derived
const someoneElseIsOwner = isOwnChannel && !isOwner && owner !== null;
```

## Flows

### Tab A opens (fresh, no owner)

```
Tab A                          Server
  |-- connect ------------------>|
  |<-- sync-full (owner:null) ---|
  |-- claim-ownership ---------->|
  |<-- ownership-granted --------|
  |<-- update-channel (owner:A) -|
  |-- [auto-connect IRC] --------|
```

### Tab B opens while Tab A is owner

```
Tab B                          Server
  |-- connect ------------------>|
  |<-- sync-full (owner:A) ------|
  |   [sees owner!=null, no auto-claim]
  |   [shows "Conectado em outra janela"]
```

### Tab A disconnects, Tab B claims

```
Tab A                          Server                         Tab B
  |-- release-ownership -------->|                              |
  |<-- update-channel (null) ----|-- update-channel (null) ---->|
  |   [isOwner=false]            |   [owner=null, can claim]    |
                                 |<-- claim-ownership ----------|
                                 |-- ownership-granted -------->|
                                 |-- update-channel (owner:B) ->|
```

## Auto-claim Logic

Client auto-claims **once** on initial connect if:
- `isOwnChannel` (viewing own channel)
- `partyConnected` (WebSocket ready)
- `owner === null` (no one has lock)
- `!isOwner` (we don't already have it)
- `!hasTriedAutoClaim` (haven't tried yet this session)

After conflict (owner !== null on connect), user must click "Conectar" manually.

## UI States

| State | `isOwner` | `owner` | Display |
|-------|-----------|---------|---------|
| Disconnected | false | null | "Desconectado" + Conectar btn |
| Someone else | false | set | "Conectado em outra janela" |
| Connecting | false→true | - | "Conectando..." |
| Connected | true | self | "Conectado" + Desconectar btn |

## Files

- `packages/shared/src/party.ts` - Message types
- `apps/api/src/party.ts` - Server lock logic
- `apps/web/src/services/party.ts` - `claimOwnership()`, `releaseOwnership()`
- `apps/web/src/store/channel.ts` - `isOwner`, `owner` state
- `apps/web/src/store/ChannelContext.tsx` - Auto-claim effects
- `apps/web/src/components/ControlPanel.tsx` - Connect/Disconnect buttons
- `apps/web/src/hooks/useConnectionStatus.ts` - Status display logic
