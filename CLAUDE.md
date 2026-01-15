# DBD Utils

See @README.md for project overview.
Keep project docs updated when making changes.

## Structure

tbd

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
