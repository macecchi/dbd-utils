# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-file web app that tracks Dead by Daylight character requests from Twitch donations. Connects to Twitch IRC, parses livepix donation messages, and uses LLMs (Gemini or Anthropic) to identify DBD characters.

## Development

Open `index.html` directly in browser - no build step required. Uses Tailwind via CDN.

## Architecture

- `index.html` - entire app (HTML + embedded JS)
- Connects to Twitch IRC via WebSocket (`wss://irc-ws.chat.twitch.tv`)
- Watches for `livepix` bot messages, parses donation format: `{donor} doou {amount}: {message}`
- LLM calls go direct to Gemini or Anthropic APIs from browser
- API keys stored in localStorage (`gemini_key`, `anthropic_key`)
