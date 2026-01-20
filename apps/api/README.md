# DBD API - Cloudflare Worker

Backend API for Twitch authentication and LLM character extraction.

## Setup

### 1. Create a Twitch application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Create a new application
3. Set OAuth Redirect URL to:
   - Development: `http://localhost:8787/auth/callback`
   - Production: `https://your-worker.your-subdomain.workers.dev/auth/callback`
4. Copy the Client ID and generate a Client Secret

### 2. Configure secrets

#### Local development

Create `.dev.vars` file in the `api/` directory:

```bash
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_random_secret_here
```

Generate a JWT secret with: `openssl rand -base64 32`

#### Production (Cloudflare)

```bash

### 3. Run locally

```bash
bun run dev

The worker will be available at `http://localhost:8787`.

### 4. Deploy

```bash
bun run deploy
```

## Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Redirects to Twitch OAuth |
| GET | `/auth/callback` | Handles OAuth callback, issues JWT |
| POST | `/auth/refresh` | Refreshes access token |
| GET | `/auth/me` | Returns current user info |

### Protected API

All `/api/*` routes require `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/extract-character` | Extract character from message (TODO) |

## Frontend configuration

Set the API URL in your frontend `.env`:

```bash
VITE_API_URL=http://localhost:8787
```

For production:

```bash
VITE_API_URL=https://your-worker.your-subdomain.workers.dev
```
