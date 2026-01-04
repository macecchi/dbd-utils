# CLAUDE.md

## Project Overview

Single-file web app that tracks Dead by Daylight character requests from Twitch donations. Connects to Twitch IRC, parses livepix donation messages, and uses LLM to identify DBD characters.

## Development

```bash
bun dev
```

No build step required. Uses Tailwind via CDN.

## Architecture

- `index.html` - entire app (HTML + embedded JS)
- Connects to Twitch IRC via WebSocket (`wss://irc-ws.chat.twitch.tv`)
- Watches for `livepix` bot messages, parses donation format: `{donor} doou {amount}: {message}`
- LLM calls go direct to Gemini from browser
- API keys stored in localStorage
