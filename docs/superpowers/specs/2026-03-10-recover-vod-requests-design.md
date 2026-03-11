# Recuperar Pedidos — Recover Requests from Past VODs

## Overview

New section in SourcesPanel lets streamers recover requests from past VODs. Two-step flow: select VODs → review extracted requests.

## Flow

1. User clicks "Recuperar pedidos" button in new SourcesPanel card
2. **VODSelectionDialog** opens — shows last 10 VODs (title, date, duration) with checkboxes. "Carregar mais" fetches 10 more.
3. User selects VODs, confirms → system fetches chat from selected VODs, scans for donations + chat commands using `parseDonationMessage()` and chat command regex
4. Character identification: `tryLocalMatch()` only — no LLM calls at this stage
5. **MissedRequestsDialog** opens with extracted requests. Rows matching existing queue requests (by request ID) shown as disabled/greyed-out.
6. User picks which to import → "Adicionar" merges selected into queue. Unresolved characters get `needsIdentification: true` → LLM runs in queue like any new request.

## Components

### RecoverRequestsCard
- New card in SourcesPanel, below existing source cards
- Icon + "Recuperar pedidos" button
- Only visible to channel owner

### VODSelectionDialog
- Modal listing VODs with checkboxes
- Each row: title, date, duration, thumbnail (if available)
- Initial load: 10 most recent VODs via `fetchRecentVods(channel, 10)`
- "Carregar mais" button fetches next 10 (cursor-based pagination)
- Confirm/cancel footer
- Loading state while fetching VOD list

### MissedRequestsDialog (extended)
- New optional `disabledIds: Set<number>` prop
- Disabled rows: greyed-out, checkbox disabled, tooltip "Já na fila"
- Disabled requests excluded from select all/deselect all
- Auto-select only non-disabled new requests
- Rest of behavior unchanged (progressive loading, spinner, select/deselect)

## Data Flow

### VOD List
- New `fetchRecentVods(channel, count, cursor?)` in `vod.ts`
- Reuses existing `fetchGQL` with CORS proxy fallback
- GQL query: `user(login:$login){videos(first:$count,after:$cursor,type:ARCHIVE,sort:TIME)}`

### Chat Scanning
- New `scanVODForRequests(vodId, vodStart, sourcesConfig)` in `vod.ts`
- Iterates VOD chat pages via existing `fetchGQL` pattern
- For each message:
  - If donations enabled: `parseDonationMessage()` → check min amount
  - If chat enabled: match chat command regex → check sub tier
- Returns `Request[]` with `tryLocalMatch()` applied, `needsIdentification` set for unresolved
- Progressive: calls `onRequest(req)` callback as requests are found (same pattern as `recoverMissedRequests`)

### Deduplication
- Match by request ID (deterministic hash from Twitch message ID)
- IDs of current queue passed as `disabledIds` to MissedRequestsDialog

## Source Config Awareness

Scan respects user's current source settings:
- **Donations**: scan for donation bot messages, respect `minAmount`
- **Chat**: scan for configured command, respect `minTier` filter
- **Resubs**: not recoverable (USERNOTICE not in VOD chat)
- **Manual**: not applicable

## Edge Cases

- No VODs found: show empty state in VODSelectionDialog
- VOD chat empty: show "Nenhum pedido encontrado" in MissedRequestsDialog
- All recovered requests are duplicates: all rows disabled, user sees what was skipped
- User cancels mid-scan: abort fetch, discard partial results
