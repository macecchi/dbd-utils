# dbd-utils

Web app that tracks Dead by Daylight character requests from multiple Twitch sources.

## Features

- Twitch IRC WebSocket connection (read-only, no auth needed)
- Multi-source request tracking: donations, resubs, chat commands, manual entry
- Gemini LLM extracts survivor/killer from message (local keyword match first)
- Queue view sorted by priority + timestamp with killer portraits
- Mark requests done (click or keyboard), bulk clear
- Undo delete with Ctrl/Cmd+Z
- VOD chat replay via Twitch GQL API
- All data persisted to localStorage

## Request Sources

| Source | Trigger | Limit | Icon |
|--------|---------|-------|------|
| Donations | Bot message pattern | Min amount threshold | $ |
| Resubs | USERNOTICE msg-id=resub | 1 per resub event | loop |
| Chat | Configurable command (default: `!request`) | 1 per session per user | message |
| Manual | Autocomplete character entry | None | pencil |

## Setup

1. Run dev server: `bun dev`
2. Enter channel name and connect
3. (Optional) Add [Gemini API key](https://aistudio.google.com/apikey) for auto character detection

Works without API key if character names are mentioned directly.

## Config

- **Channel**: Twitch channel to monitor
- **Bot name**: Username that posts donation messages (default: livepix)
- **Min donation**: Requests below this are collapsed
- **Gemini models**: Fallback list for rate limits

### Sources Panel

- Toggle each source on/off
- Set chat command name
- Set eligible subscriber tiers for chat command
- Drag to reorder source priority
- "Nova Stream" button resets session limits for chat commands

## License

MIT
