# mandy-utils

Single-file web app that tracks Dead by Daylight character requests from Twitch donations.

## Features

- Connects to Twitch IRC via WebSocket
- Parses livepix donation messages
- Uses LLMs (Gemini or Anthropic) to identify DBD characters

## Usage

Open `index.html` in browser or run dev server:

```bash
bun dev
```

API keys stored in localStorage via settings modal.

## License

MIT
