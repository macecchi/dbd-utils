# DBD Utils

See @README.md for project overview.
Keep project docs updated when making changes.

## Structure

```
apps/
├── web/              # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── services/
│   │   ├── store/
│   │   ├── styles/
│   │   ├── types/
│   │   └── App.tsx
│   └── public/
└── api/              # Cloudflare Worker backend (Hono) + PartyKit
    └── src/
        ├── index.ts    # Hono API (auth)
        └── party.ts    # PartyKit server (real-time sync)
```

## Commands

```bash
bun install          # Install all deps
bun run dev          # Start frontend + API + PartyKit
bun run build        # Build frontend
bun run test         # Run all tests (uses Vitest)
bun run typecheck    # Type check all packages
bun run deploy:api   # Deploy API to Cloudflare
bun run deploy:party # Deploy PartyKit
```

> **Note:** Use `bun run test`, not `bun test`. The project uses Vitest for testing,
> but `bun test` invokes Bun's native test runner which is incompatible with this project.

## Key functions

- `connect()` - Twitch IRC WebSocket
- `handleMessage()` - Parse donation bot + chat commands
- `handleUserNotice()` - Parse resub USERNOTICE
- `handleChatCommand()` - Process chat requests with session limits
- `callLLM()` - Gemini API with model fallback/retry
- `identifyCharacter()` - Local match first, then LLM fallback
- `loadAndReplayVOD()` - VOD chat replay via GQL

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
- `dbd-auth` - Twitch auth tokens and user info
