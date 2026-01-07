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
- `handleMessage()` - Parse donation bot messages
- `callLLM()` - Gemini API with model fallback/retry
- `identifyCharacter()` - Extract character from message
- `renderDonations()` - Queue UI sorted by timestamp
- `loadAndReplayVOD()` - VOD chat replay via GQL

## Data

All state in localStorage:

- `dbd_donations` - Request queue
- `dbd_chat` - Recent chat messages
- `dbd_channel`, `dbd_bot_name`, `dbd_min_donation`
- `gemini_key`, `gemini_models`
