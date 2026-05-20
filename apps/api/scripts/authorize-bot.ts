#!/usr/bin/env bun
// One-time OAuth flow to mint a user access token for the @filadbd bot account.
// Run from `apps/api/`:
//
//   TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=... bun scripts/authorize-bot.ts
//
// Requirements:
// - Log in to twitch.tv as @filadbd in your default browser BEFORE running this.
// - Add http://localhost:8923/callback to the Twitch app's OAuth Redirect URLs
//   (Twitch dev console → Manage → OAuth Redirect URLs).
// - TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are the same app credentials the
//   Worker uses; the bot account is just a separate user inside that app.
//
// Output: a JSON BotToken to paste into KV under key `bot_token`. Two `wrangler kv`
// commands are printed at the end — one for `--remote` (production), one for `--local`.
import { spawn } from 'node:child_process';

const SCOPES = 'user:write:chat user:read:chat user:read:moderated_channels';
const PORT = 8923;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing TWITCH_CLIENT_ID and/or TWITCH_CLIENT_SECRET in environment.');
  console.error('Source them from apps/api/.dev.vars or your secrets vault before running.');
  process.exit(1);
}

const STATE = crypto.randomUUID();

const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('state', STATE);
authUrl.searchParams.set('force_verify', 'true');

console.log('\n@filadbd bot authorization');
console.log('--------------------------');
console.log('1. Make sure you are logged into twitch.tv as @filadbd in your default browser.');
console.log('2. The browser should open to the consent screen. If it does not, open this URL manually:\n');
console.log('   ' + authUrl.toString() + '\n');

try {
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [authUrl.toString()], { stdio: 'ignore', detached: true }).unref();
} catch {
  // Manual fallback: user opens the URL above themselves.
}

console.log(`Waiting for Twitch to redirect back to ${REDIRECT_URI} ...\n`);

const code = await new Promise<string>((resolve, reject) => {
  const server = Bun.serve({
    port: PORT,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== '/callback') return new Response('Not found', { status: 404 });

      const errorParam = url.searchParams.get('error');
      const codeParam = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');

      if (errorParam) {
        const desc = url.searchParams.get('error_description') ?? '';
        queueMicrotask(() => {
          server.stop();
          reject(new Error(`Twitch returned error: ${errorParam} — ${desc}`));
        });
        return new Response(`Error: ${errorParam} — ${desc}`, { status: 400 });
      }

      if (!codeParam || stateParam !== STATE) {
        queueMicrotask(() => {
          server.stop();
          reject(new Error('Missing code or state mismatch (possible CSRF).'));
        });
        return new Response('Invalid request.', { status: 400 });
      }

      queueMicrotask(() => {
        server.stop();
        resolve(codeParam);
      });
      return new Response('Got it! You can close this tab and return to the terminal.', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    },
  });
});

console.log('Exchanging code for tokens...');
const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  }),
});

if (!tokenRes.ok) {
  console.error('Token exchange failed:', tokenRes.status, await tokenRes.text());
  process.exit(1);
}

const tokens = await tokenRes.json() as {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
};

console.log('Fetching bot user identity...');
const userRes = await fetch('https://api.twitch.tv/helix/users', {
  headers: { Authorization: `Bearer ${tokens.access_token}`, 'Client-Id': CLIENT_ID },
});
if (!userRes.ok) {
  console.error('User fetch failed:', userRes.status, await userRes.text());
  process.exit(1);
}
const userData = await userRes.json() as { data: Array<{ id: string; login: string }> };
const user = userData.data[0];
if (!user) {
  console.error('Twitch returned no user data.');
  process.exit(1);
}

const botToken = {
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
  user_id: user.id,
  login: user.login,
};

console.log(`\n✅ Authorized as @${user.login} (user_id: ${user.id})`);
console.log(`Granted scopes: ${tokens.scope.join(', ')}`);
if (user.login !== 'filadbd') {
  console.warn(`\n⚠️  WARNING: expected to authorize @filadbd but got @${user.login}.`);
  console.warn('Log in to twitch.tv as the bot account and re-run.');
}

const jsonValue = JSON.stringify(botToken);
const shellEscaped = jsonValue.replace(/'/g, "'\\''");

console.log('\nBotToken JSON:\n');
console.log(jsonValue);
console.log('\nStore in production KV (run from apps/api/):');
console.log(`  bunx wrangler kv key put --env=production --binding=CACHE bot_token '${shellEscaped}' --remote`);
console.log('\nStore in local (dev) KV:');
console.log(`  bunx wrangler kv key put --binding=CACHE bot_token '${shellEscaped}' --local`);
console.log('\nNote: --env=production is required for remote writes because the default');
console.log('[[kv_namespaces]] block in wrangler.toml uses id="local" (a Miniflare sentinel).');
console.log('The real production namespace lives under [env.production].');
console.log('\nDone. Refresh tokens rotate; the Worker handles that automatically.');
