# dbd-utils

Web app that tracks Dead by Daylight character requests from Twitch donation bot notifications.

## Features

- Twitch IRC WebSocket connection (read-only, no auth needed)
- Parses donation bot messages: `{donor} doou {amount}: {message}`
- Gemini LLM extracts survivor/killer from message
- Queue view sorted oldest-first with killer portraits
- Mark requests done (click or keyboard), bulk clear
- Undo delete with Ctrl/Cmd+Z
- VOD chat replay via Twitch GQL API
- Min donation threshold filter
- All data persisted to localStorage

## Setup

1. Run dev server: `bun dev`
2. Enter channel name and connect
3. (Optional) Add [Gemini API key](https://aistudio.google.com/apikey) for auto character detection

Works without API key - requests queue up but won't auto-identify characters.

## Config

- **Channel**: Twitch channel to monitor
- **Bot name**: Username that posts donation messages (default: livepix)
- **Min donation**: Requests below this are collapsed
- **Gemini models**: Fallback list for rate limits

## License

MIT
