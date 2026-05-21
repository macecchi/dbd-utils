# Donation extras / build requests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first instance of a generic "request extras" system — a free-text `build` extra attached to donation requests above a per-room price, surfaced as a 4-slot perk badge on the avatar plus inline highlights in the donor message.

**Architecture:** Additive optional fields end-to-end (D1 columns, DO payload, protocol). New `RequestExtra` discriminated union with one variant for now (`build`). Eligibility gated on amount only — the LLM call already happens on every donation; we just append a per-extra prompt block when the donation clears the configured price. UI changes are localized: a new `BuildBadge` overlay on `CharacterAvatar`, a renamed `highlightTerms` helper accepting an array of strings, and a nested "Extras" block inside the existing Donations settings row.

**Tech Stack:** TypeScript / Bun, React (Vite), Cloudflare Workers (Hono), PartyKit (Durable Objects), D1, Zustand, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-21-donation-extras-builds-design.md`](../specs/2026-05-21-donation-extras-builds-design.md)

---

## File map

**Create:**
- `apps/api/migrations/0007_add_extras.sql`
- `apps/web/src/components/BuildBadge.tsx`
- `apps/web/src/components/settings/ExtraRow.tsx`

**Modify:**
- `packages/shared/src/types.ts` — add `RequestExtra`, `RoomExtras`, `ExtraConfig`, `Request.extras`
- `packages/shared/src/party.ts` — add `extras` on `SerializedRequest`, `extrasConfig` on `SourcesSettings`, pass through in serialize/deserialize
- `apps/api/src/gemini.ts` — accept `extras` param; conditionally append build prompt block and extend `responseSchema`
- `apps/api/src/index.ts` — accept `extras` body field on `/api/extract-character`; accept `extras` per row and `extras` on sources in internal endpoints
- `apps/api/src/index.test.ts` — coverage for new fields
- `apps/api/src/gemini.eval.test.ts` — build extraction live-eval cases
- `apps/web/src/services/llm.ts` — `identifyMultiple` accepts/returns build; add `eligibleExtras` helper
- `apps/web/src/services/twitch.ts` — donation handler passes eligible extras into the LLM call
- `apps/web/src/services/donation.ts` — `buildDonationRequests` carries extras into each `Request`
- `apps/web/src/services/donation.test.ts` — tests for extras propagation
- `apps/web/src/store/channel.ts` — `extrasConfig` on `SourcesStore`, default write on first hydrate
- `apps/web/src/store/channel.test.ts` — default-write coverage
- `apps/web/src/utils/helpers.ts` — new `highlightTerms` helper
- `apps/web/src/utils/helpers.test.ts` — coverage
- `apps/web/src/components/CharacterAvatar.tsx` — render BuildBadge when extras present
- `apps/web/src/components/CharacterRequestCard.tsx` — pass extras to avatar; use `highlightTerms`; hover/tap interaction
- `apps/web/src/components/settings/SourcesSection.tsx` — nest Extras block under donation row
- `apps/web/src/data/mock-requests.ts` — one demo entry with a build
- `apps/web/src/App.tsx` — re-identify-all loop passes extras
- `apps/web/src/i18n/locales/en.ts` + `pt-BR.ts` — new label keys
- `apps/web/src/styles/requests.css` — badge + tooltip styles
- `apps/web/src/styles/settings-panel.css` — extras-row indent / divider

**No changes (verify only):**
- `apps/api/src/party.ts` — `extras` flows through the existing `serializeRequest` path; `extrasConfig` flows through the existing `update-sources` path; only D1 sync route needs updates (covered via `apps/api/src/index.ts`).

---

## Conventions used in this plan

- **`bun run test`** is the test command (per CLAUDE.md). Never `bun test`.
- **`bun run typecheck`** runs project-wide TypeScript checks.
- **All commits use Conventional Commits** matching the project's existing style (`feat(scope):`, `fix(scope):`, etc.). The branch is `claude/elegant-margulis-530ed1` — work directly on it; do not branch further.
- **TDD where unit tests already cover the area** (helpers, donation builder, channel store, API endpoints, eval). For pure UI components and styles, verify by reading code + the preview workflow (manual `preview_*` checks at the end).
- **Don't run a dev server until the verification phase** — most changes can be verified by tests + typecheck.

---

## Task 1: Shared `RequestExtra` / `RoomExtras` types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add new types and `Request.extras` field**

Append to the bottom of [`packages/shared/src/types.ts`](packages/shared/src/types.ts), and add `extras?` to the existing `Request` interface (insert just after `originMsgId?: string;`).

```ts
// Added to the existing `Request` interface, immediately after `originMsgId?: string;`:
  extras?: RequestExtra[];
```

Then append at end of file:

```ts
// ---------- Donation extras ----------
//
// A donation that clears `min_donation` can carry zero or more extras. Each
// extra has its own price configured per room. The first (and currently only)
// extra type is `build`: a free-text description of the loadout the donor
// wants the streamer to play, plus optional substrings of the original donor
// message that we highlight in the UI.
//
// Future extras (challenge, map offering, etc.) extend the `RequestExtraType`
// union and add a variant to `RequestExtra`. No schema migration required —
// `extras` is stored as a JSON column on D1 and as an inline field in the
// PartyKit per-request payload.

export type RequestExtraType = 'build';

export type RequestExtra =
  | { type: 'build'; text: string; matchedTerms?: string[] };

export interface ExtraConfig {
  enabled: boolean;
  price: number;
}

export interface RoomExtras {
  build?: ExtraConfig;
}

export const BUILD_DEFAULT_PRICE = 10;

export const DEFAULT_EXTRAS_CONFIG: RoomExtras = {
  build: { enabled: true, price: BUILD_DEFAULT_PRICE },
};
```

- [ ] **Step 2: Run typecheck to confirm shared package still compiles**

Run: `bun run typecheck`
Expected: PASS (no errors). The new types are not yet referenced elsewhere.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat(shared): add RequestExtra / RoomExtras types for donation extras"
```

---

## Task 2: Shared serialization (`SerializedRequest`, `SourcesSettings`)

**Files:**
- Modify: `packages/shared/src/party.ts`

- [ ] **Step 1: Add fields to `SerializedRequest` and `SourcesSettings`**

In [`packages/shared/src/party.ts`](packages/shared/src/party.ts), add the `RequestExtra` and `RoomExtras` imports and extend both interfaces.

Update the import line (currently `import type { Request, SourcesEnabled } from './types';`):

```ts
import type { Request, SourcesEnabled, RequestExtra, RoomExtras } from './types';
```

Inside `SerializedRequest`, add after the existing `matchedTerm?: string;` line:

```ts
  extras?: RequestExtra[];
```

Inside `SourcesSettings`, add after the existing `confirmInChat?: boolean;` line:

```ts
  extrasConfig?: RoomExtras;
```

- [ ] **Step 2: Verify `serializeRequest` / `deserializeRequest` pass extras through**

Read the existing `serializeRequest` and `deserializeRequest` — both use spread (`...req`) and only override Date fields. The new `extras` field is already passed through; **no code change required in these two functions**.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Run shared tests (if any) and party tests**

Run: `bun run test`
Expected: All existing tests pass. No new failures from the additive interface fields.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/party.ts
git commit -m "feat(shared): carry extras on SerializedRequest and extrasConfig on SourcesSettings"
```

---

## Task 3: D1 migration `0007_add_extras.sql`

**Files:**
- Create: `apps/api/migrations/0007_add_extras.sql`

- [ ] **Step 1: Write migration**

Create [`apps/api/migrations/0007_add_extras.sql`](apps/api/migrations/0007_add_extras.sql):

```sql
-- Add optional `extras` JSON column to requests and `extras_config` JSON column to rooms.
-- Both are nullable; absence means "no extras" / "use defaults". Storing as TEXT (JSON
-- string) matches how `chat_tiers` and `priority` are persisted on `rooms`.
ALTER TABLE requests ADD COLUMN extras TEXT;
ALTER TABLE rooms    ADD COLUMN extras_config TEXT;
```

- [ ] **Step 2: Apply migration locally**

Run: `cd apps/api && bunx wrangler d1 migrations apply fila-dbd --local`
Expected: Migration `0007_add_extras` applied. No errors.

- [ ] **Step 3: Verify columns exist locally**

Run: `cd apps/api && bunx wrangler d1 execute fila-dbd --local --command "PRAGMA table_info(requests);" | grep extras`
Expected: One row containing `extras` and type `TEXT`.

Run: `cd apps/api && bunx wrangler d1 execute fila-dbd --local --command "PRAGMA table_info(rooms);" | grep extras_config`
Expected: One row containing `extras_config` and type `TEXT`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/migrations/0007_add_extras.sql
git commit -m "feat(api): D1 migration for request extras and room extras_config"
```

---

## Task 4: Backend `extractCharacters` accepts extras

**Files:**
- Modify: `apps/api/src/gemini.ts`
- Test: `apps/api/src/index.test.ts` (existing test file — `extractCharacters` is mocked there, real coverage happens in eval tests later)

- [ ] **Step 1: Update `ExtractionResult` and signature**

In [`apps/api/src/gemini.ts`](apps/api/src/gemini.ts), update the top of the file:

```ts
import { DEFAULT_CHARACTERS } from '@dbd-utils/shared';
import type { RequestExtraType } from '@dbd-utils/shared';

const MODELS = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const RETRIABLE_CODES = [429, 500, 502, 503, 504];
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

let currentModelIndex = 0;

export type ExtractionResult = {
  character: string;
  type: 'survivor' | 'killer' | 'none';
  matchedTerm?: string;
  build?: { text: string; matchedTerms?: string[] };
};

export async function extractCharacters(
  message: string,
  apiKey: string,
  maxCount: number,
  extras: RequestExtraType[] = [],
  attempt = 0,
  modelIdx = currentModelIndex,
  startIdx = currentModelIndex
): Promise<ExtractionResult[]> {
```

- [ ] **Step 2: Build prompt addendum and conditional schema**

Inside `extractCharacters`, just before the existing `const prompt = ...` block, add:

```ts
  const withBuild = extras.includes('build');

  const buildBlock = withBuild ? `

For each character entry, also try to identify a "build" the donor wants for that character. A build is a description of the loadout the streamer should equip — it may include perk names (DBD has hundreds, in English or Portuguese with creative spellings and slang), addon names, item or item-addon names (survivor loadouts), a theme like "build de aura" / "build irritante" / "build de endgame", or an explicit "no perks" / "sem perks" instruction.

Builds apply equally to killer and survivor character entries.

If the message contains build text, attach it to the appropriate character(s):
- "Pig e Hag de build de aura" → same build text on both rows.
- "Pig de aura e Hag de gritos" → different build text per row.
- "3 trickster de build X" → same build on all three quantified rows.
- If a build is mentioned but it's unclear which character it belongs to, attach it to the first character entry.

Return build as { text, matchedTerms[] }:
- text: brief human-readable summary, in the donor's language (verbatim is fine; clean up obvious typos but keep the donor's wording/slang).
- matchedTerms: array of exact substrings of <user_message> that describe the build. Perks and addons may be separated by other words — include each contiguous span as a separate entry.

Omit the build field when no build text is present.
` : '';
```

Then append `${buildBlock}` to the end of the existing prompt template literal (just before the closing backtick).

For the response schema, locate the existing `responseSchema` object inside the fetch body. Replace the `items` object with a version that conditionally includes `build`:

```ts
          responseSchema: {
            type: 'object',
            properties: {
              characters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    character: { type: 'string' },
                    type: { type: 'string', enum: ['survivor', 'killer', 'none'] },
                    matchedTerm: { type: 'string' },
                    ...(withBuild ? {
                      build: {
                        type: 'object',
                        properties: {
                          text: { type: 'string' },
                          matchedTerms: { type: 'array', items: { type: 'string' } },
                        },
                        required: ['text'],
                      },
                    } : {}),
                  },
                  required: ['character', 'type'],
                },
              },
            },
            required: ['characters'],
          },
```

- [ ] **Step 3: Propagate `extras` through the recursion calls**

Both recursive calls inside `extractCharacters` (the model-switching retry and the post-empty-response retry) currently look like:

```ts
return extractCharacters(message, apiKey, maxCount, 0, nextIdx, startIdx);
```

Update both to pass `extras` through:

```ts
return extractCharacters(message, apiKey, maxCount, extras, 0, nextIdx, startIdx);
```

…and also the in-attempt retry call:

```ts
return extractCharacters(message, apiKey, maxCount, extras, attempt + 1, modelIdx, startIdx);
```

- [ ] **Step 4: Log extras in the per-call log line**

Update the existing log line that reads `[extract] Starting extraction using model: ...`:

```ts
  console.log(`[extract] Starting extraction using model: ${model} (attempt ${attempt + 1}/${MAX_RETRIES + 1}, maxCount=${maxCount}, extras=${extras.join(',') || 'none'})`);
```

- [ ] **Step 5: Run unit tests**

Run: `bun run test`
Expected: PASS. The Vitest mock of `extractCharacters` in `apps/api/src/index.test.ts` uses `vi.fn().mockResolvedValue(...)` and is signature-agnostic for unused args, so existing tests remain green.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/gemini.ts
git commit -m "feat(api): extractCharacters accepts extras param for build extraction"
```

---

## Task 5: `/api/extract-character` endpoint accepts `extras`

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/index.test.ts`

- [ ] **Step 1: Write failing test for extras passthrough**

In [`apps/api/src/index.test.ts`](apps/api/src/index.test.ts), add a new test inside the existing `describe('POST /api/extract-character', () => { ... })` block:

```ts
    it('forwards extras param to extractCharacters', async () => {
      const { extractCharacters } = await import('./gemini');
      vi.mocked(extractCharacters).mockClear();
      vi.mocked(extractCharacters).mockResolvedValueOnce([
        { character: 'Krasue', type: 'killer', matchedTerm: 'kraseu', build: { text: 'lethal, dissolution', matchedTerms: ['lethal, dissolution'] } },
      ]);

      const res = await app.request('/api/extract-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ message: 'kraseu de lethal, dissolution', maxCount: 1, extras: ['build'] }),
      }, mockEnv as any);

      expect(res.status).toBe(200);
      expect(vi.mocked(extractCharacters)).toHaveBeenCalledWith(
        'kraseu de lethal, dissolution',
        expect.any(String),
        1,
        ['build']
      );
      const body = await res.json();
      expect(body.characters[0].build).toEqual({ text: 'lethal, dissolution', matchedTerms: ['lethal, dissolution'] });
    });
```

If the existing tests don't use `mockEnv` or `Authorization: 'Bearer valid-token'` exactly as written, mirror whatever pattern the file already uses for an authenticated request — read the file's first existing `extract-character` test to copy its scaffolding.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: FAIL — endpoint currently ignores `extras` and calls `extractCharacters(message, key, maxCount)` (three args).

- [ ] **Step 3: Update endpoint to accept and forward extras**

In [`apps/api/src/index.ts`](apps/api/src/index.ts) inside the `api.post("/extract-character", ...)` handler, change:

```ts
  const body = await c.req.json<{ message: string; maxCount?: number }>();
```

to:

```ts
  const body = await c.req.json<{ message: string; maxCount?: number; extras?: RequestExtraType[] }>();
```

Add the import at the top of `apps/api/src/index.ts`:

```ts
import type { RequestExtraType } from "@dbd-utils/shared";
```

(Place it near the existing `import { extractCharacters } from "./gemini";` line.)

Then change the call site (around the existing `const characters = await extractCharacters(...)` line) to:

```ts
    const extras: RequestExtraType[] = Array.isArray(body.extras)
      ? body.extras.filter((e): e is RequestExtraType => e === 'build')
      : [];

    const characters = await extractCharacters(body.message, c.env.GEMINI_API_KEY, maxCount, extras);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: PASS — new test passes, existing `extract-character` tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/index.test.ts
git commit -m "feat(api): /api/extract-character accepts extras body field"
```

---

## Task 6: Internal sources endpoint persists `extras_config`

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/index.test.ts`

- [ ] **Step 1: Write failing test**

In `index.test.ts`, locate any existing test for `PUT /internal/rooms/:roomId/sources` (search for `/internal/rooms/`). Add or extend a test that posts an `extrasConfig` and verifies it's persisted to D1.

```ts
    it('persists extrasConfig to D1 extras_config column', async () => {
      const bindCalls: unknown[][] = [];
      const mockDB = {
        prepare: vi.fn(() => ({
          bind: vi.fn((...args: unknown[]) => {
            bindCalls.push(args);
            return { run: vi.fn().mockResolvedValue({ success: true }) };
          }),
        })),
      };
      const env = { ...mockEnv, DB: mockDB as any, INTERNAL_API_SECRET: 'shh' };

      const res = await app.request('/internal/rooms/mandymess/sources', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer internal:shh',
        },
        body: JSON.stringify({
          enabled: { donation: true, chat: true, resub: false, manual: true },
          chatCommand: '!fila',
          chatTiers: [2, 3],
          priority: ['donation', 'chat', 'resub', 'manual'],
          sortMode: 'fifo',
          minDonation: 5,
          extrasConfig: { build: { enabled: true, price: 12 } },
        }),
      }, env);

      expect(res.status).toBe(200);
      // extras_config must appear as a JSON-encoded string in the bind args
      const args = bindCalls[0] ?? [];
      const stringified = args.find((a) => typeof a === 'string' && a.includes('"build"'));
      expect(stringified).toBe(JSON.stringify({ build: { enabled: true, price: 12 } }));
    });
```

(Mirror the project's existing mocking style — read the existing internal-sources test for the exact `mockEnv` and `prepare` shape and adapt accordingly. The above is the assertion target; the exact mock harness must match what's already in the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: FAIL — endpoint does not currently include `extras_config` in the INSERT.

- [ ] **Step 3: Add column to INSERT statement**

In the `internal.put("/rooms/:roomId/sources", ...)` handler in `apps/api/src/index.ts`:

Update the body type:

```ts
  const body = await c.req.json<{
    enabled: Record<string, boolean>;
    chatCommand: string;
    chatTiers: number[];
    priority: string[];
    sortMode: string;
    minDonation: number;
    recoveryVodId?: string;
    recoveryVodOffset?: number;
    extrasConfig?: Record<string, unknown>;
  }>();
```

Update the SQL — add `extras_config` to the column list, the placeholder list, and the `DO UPDATE SET` clause:

```ts
  await c.env.DB.prepare(
    `INSERT INTO rooms (id, channel_login, enabled_donation, enabled_chat, enabled_resub, enabled_manual, chat_command, chat_tiers, priority, sort_mode, min_donation, recovery_vod_id, recovery_vod_offset, extras_config, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       enabled_donation = excluded.enabled_donation,
       enabled_chat = excluded.enabled_chat,
       enabled_resub = excluded.enabled_resub,
       enabled_manual = excluded.enabled_manual,
       chat_command = excluded.chat_command,
       chat_tiers = excluded.chat_tiers,
       priority = excluded.priority,
       sort_mode = excluded.sort_mode,
       min_donation = excluded.min_donation,
       recovery_vod_id = excluded.recovery_vod_id,
       recovery_vod_offset = excluded.recovery_vod_offset,
       extras_config = excluded.extras_config,
       updated_at = datetime('now')`
  ).bind(
    roomId,
    roomId,
    body.enabled?.donation ? 1 : 0,
    body.enabled?.chat ? 1 : 0,
    body.enabled?.resub ? 1 : 0,
    body.enabled?.manual ? 1 : 0,
    body.chatCommand ?? "!fila",
    JSON.stringify(body.chatTiers ?? [2, 3]),
    JSON.stringify(body.priority ?? ["donation", "chat", "resub", "manual"]),
    body.sortMode ?? "fifo",
    body.minDonation ?? 5,
    body.recoveryVodId ?? null,
    body.recoveryVodOffset ?? null,
    body.extrasConfig ? JSON.stringify(body.extrasConfig) : null
  ).run();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/index.test.ts
git commit -m "feat(api): persist extrasConfig to rooms.extras_config"
```

---

## Task 7: Internal requests endpoint persists `extras` per row

**Files:**
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/index.test.ts`

- [ ] **Step 1: Write failing test**

In `index.test.ts`, alongside the existing tests for `PUT /internal/rooms/:roomId/requests`, add:

```ts
    it('persists per-row extras to requests.extras column', async () => {
      const bindCalls: unknown[][] = [];
      const mockDB = {
        prepare: vi.fn(() => ({
          bind: vi.fn((...args: unknown[]) => {
            bindCalls.push(args);
            return { run: vi.fn().mockResolvedValue({ success: true }) };
          }),
        })),
        batch: vi.fn().mockResolvedValue([]),
      };
      const env = { ...mockEnv, DB: mockDB as any, INTERNAL_API_SECRET: 'shh' };

      const extras = [{ type: 'build', text: 'lethal, dissolution', matchedTerms: ['lethal, dissolution'] }];

      const res = await app.request('/internal/rooms/mandymess/requests', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer internal:shh',
        },
        body: JSON.stringify({
          mode: 'partial',
          requests: [{
            id: 1,
            timestamp: new Date().toISOString(),
            donor: 'donor',
            amount: 'R$10',
            amountVal: 10,
            message: 'kraseu de lethal, dissolution',
            character: 'Krasue',
            type: 'killer',
            source: 'donation',
            extras,
          }],
        }),
      }, env);

      expect(res.status).toBe(200);
      // The INSERT INTO requests bind args should include the JSON-encoded extras
      const requestBindArgs = bindCalls.find((args) =>
        args.some((a) => typeof a === 'string' && a.includes('"type":"build"'))
      );
      expect(requestBindArgs).toBeDefined();
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: FAIL — current INSERT doesn't include the extras column.

- [ ] **Step 3: Add `extras` to the INSERT statement**

In the `internal.put("/rooms/:roomId/requests", ...)` handler, update the upsert SQL block. Add `extras` to the column list, add a placeholder, and add it to `DO UPDATE SET`:

```ts
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO requests (id, room_id, position, timestamp, donor, amount, amount_val, message, character, type, done, done_at, source, sub_tier, needs_identification, matched_term, origin_msg_id, extras)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (room_id, id) DO UPDATE SET
           position = excluded.position,
           character = excluded.character,
           type = excluded.type,
           done = excluded.done,
           done_at = excluded.done_at,
           needs_identification = excluded.needs_identification,
           matched_term = excluded.matched_term,
           origin_msg_id = excluded.origin_msg_id,
           extras = excluded.extras`
      ).bind(
        r.id,
        roomId,
        position,
        r.timestamp,
        r.donor,
        r.amount ?? "",
        r.amountVal ?? 0,
        r.message ?? "",
        r.character ?? "",
        r.type ?? "unknown",
        r.done ? 1 : 0,
        r.doneAt ?? null,
        r.source,
        r.subTier ?? null,
        r.needsIdentification ? 1 : 0,
        r.matchedTerm ?? null,
        r.originMsgId ?? null,
        r.extras ? JSON.stringify(r.extras) : null
      )
    );
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && bun run test -- index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/index.test.ts
git commit -m "feat(api): persist per-row extras to requests.extras column"
```

---

## Task 8: Internal `GET requests` endpoint returns `extras`

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Find and update the SELECT**

In [`apps/api/src/index.ts`](apps/api/src/index.ts), find the `internal.get("/rooms/:roomId/requests", ...)` handler (search for `// GET /internal/rooms/:roomId/requests`). It currently runs a `SELECT * FROM requests WHERE room_id = ? AND done = 0` (or similar) and maps rows back into the `SerializedRequest` shape.

Locate the row-mapping logic. Add parsing of the `extras` JSON column to the returned object. If the handler maps explicit fields, add:

```ts
      extras: row.extras ? JSON.parse(row.extras as string) : undefined,
```

If the handler returns rows mostly verbatim, ensure the field is JSON-parsed before being sent back (D1 returns the raw TEXT column otherwise).

Also update the `GET /api/rooms/:roomId/requests` route (search for `// GET /api/rooms/:roomId/requests`) which is the public owner-only recovery endpoint — same JSON-parse treatment for the `extras` column.

- [ ] **Step 2: Find and update the rooms select**

Find any `SELECT * FROM rooms` or similar handler that returns sources state (used by either the public read or the `GET /rooms/active`). For each, add JSON-parsing for the `extras_config` column and map it to `extrasConfig` on the returned shape:

```ts
      extrasConfig: row.extras_config ? JSON.parse(row.extras_config as string) : undefined,
```

- [ ] **Step 3: Typecheck and run tests**

Run: `bun run typecheck && bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): return parsed extras/extrasConfig from D1 recovery endpoints"
```

---

## Task 9: PartyKit pass-through verification

**Files:**
- Verify only: `apps/api/src/party.ts`

- [ ] **Step 1: Confirm the request serialization path**

Read `apps/api/src/party.ts` and search for `serializeRequest` and `'sources'`. The DO storage uses `serializeRequest`/`deserializeRequest` from `@dbd-utils/shared` (updated in Task 2). The `update-sources` handler stores the entire `SourcesSettings` object to DO storage. Both paths are field-agnostic — they pass the whole object through.

Confirm no edits required. The only thing party.ts does specifically with sources is sync to D1 via `/internal/rooms/:roomId/sources` (the body is JSON.stringified `this.sources`) — that endpoint was updated in Task 6 to accept `extrasConfig`.

- [ ] **Step 2: Run party tests**

Run: `cd apps/api && bun run test -- party.test.ts`
Expected: PASS.

No commit — verification only.

---

## Task 10: `highlightTerms` helper

**Files:**
- Modify: `apps/web/src/utils/helpers.ts`
- Test: `apps/web/src/utils/helpers.test.ts`

- [ ] **Step 1: Write failing test for `highlightTerms`**

In [`apps/web/src/utils/helpers.test.ts`](apps/web/src/utils/helpers.test.ts), add:

```ts
import { highlightTerms } from './helpers';

describe('highlightTerms', () => {
  it('wraps a single term in a mark element', () => {
    const result = highlightTerms('hello world', ['world']);
    expect(result).toHaveLength(2);
    // result[0] is the text 'hello ', result[1] is the <mark> element
    // Render-test via React-rendering would be ideal, but a quick structural assertion:
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('hello <mark class="matched-term">world</mark>');
  });

  it('wraps multiple non-overlapping terms', () => {
    const result = highlightTerms('joga de kraseu com lethal e bbq', ['kraseu', 'lethal', 'bbq']);
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toContain('<mark class="matched-term">kraseu</mark>');
    expect(html).toContain('<mark class="matched-term">lethal</mark>');
    expect(html).toContain('<mark class="matched-term">bbq</mark>');
  });

  it('drops a term that overlaps a previously-matched span', () => {
    // 'lethal pursuer' includes 'lethal' as a substring — longer span wins.
    const result = highlightTerms('use lethal pursuer', ['lethal pursuer', 'lethal']);
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('use <mark class="matched-term">lethal pursuer</mark>');
  });

  it('returns the message unchanged when no terms match', () => {
    const result = highlightTerms('plain message', ['nope']);
    const html = renderToStaticMarkup(<>{result}</>);
    expect(html).toBe('plain message');
  });

  it('returns the message as-is for empty terms array', () => {
    const result = highlightTerms('plain message', []);
    expect(result).toEqual(['plain message']);
  });
});
```

Add imports at the top of the test file if not already present:

```ts
import { renderToStaticMarkup } from 'react-dom/server';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test -- helpers.test.ts`
Expected: FAIL — `highlightTerms` does not exist.

- [ ] **Step 3: Implement `highlightTerms` in `helpers.ts`**

In [`apps/web/src/utils/helpers.ts`](apps/web/src/utils/helpers.ts), append:

```ts
import type { ReactNode } from 'react';
import { createElement } from 'react';

/**
 * Wraps each occurrence of any term in `<mark className="matched-term">…</mark>`.
 *
 * - Terms are resolved by longest-first, case-insensitive, against the original
 *   message. Each character of the message is "claimed" by at most one term —
 *   shorter terms that overlap an already-claimed span are dropped.
 * - The first match of each term is highlighted; subsequent occurrences are
 *   left as plain text (matches existing single-term behavior).
 * - Empty `terms` returns the message as a single text node.
 */
export function highlightTerms(message: string, terms: string[]): ReactNode[] {
  if (terms.length === 0) return [message];

  // Find first-occurrence ranges, sorted by length DESC then start ASC.
  const candidates = terms
    .filter(Boolean)
    .map(t => {
      const start = message.toLowerCase().indexOf(t.toLowerCase());
      return start >= 0 ? { start, end: start + t.length, text: message.slice(start, start + t.length) } : null;
    })
    .filter((c): c is { start: number; end: number; text: string } => c !== null)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);

  // Resolve overlaps: keep candidates that don't overlap any already-kept span.
  const kept: { start: number; end: number; text: string }[] = [];
  for (const c of candidates) {
    const overlaps = kept.some(k => c.start < k.end && c.end > k.start);
    if (!overlaps) kept.push(c);
  }
  kept.sort((a, b) => a.start - b.start);

  if (kept.length === 0) return [message];

  const out: ReactNode[] = [];
  let cursor = 0;
  kept.forEach((k, i) => {
    if (cursor < k.start) out.push(message.slice(cursor, k.start));
    out.push(createElement('mark', { key: `m-${i}`, className: 'matched-term' }, k.text));
    cursor = k.end;
  });
  if (cursor < message.length) out.push(message.slice(cursor));
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun run test -- helpers.test.ts`
Expected: PASS — all five `highlightTerms` cases pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/helpers.ts apps/web/src/utils/helpers.test.ts
git commit -m "feat(web): add highlightTerms helper for multiple highlight spans"
```

---

## Task 11: `eligibleExtras` helper

**Files:**
- Modify: `apps/web/src/services/llm.ts` (or extract to a new tiny module — keep co-located for now)
- Test: add `apps/web/src/services/llm.test.ts` (new) — or co-locate in `donation.test.ts` if simpler

For simplicity, place `eligibleExtras` next to where it's consumed (donation handler). Use a new test file.

- [ ] **Step 1: Write failing test**

Create `apps/web/src/services/extras.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eligibleExtras } from './extras';
import { DEFAULT_EXTRAS_CONFIG } from '@dbd-utils/shared';

describe('eligibleExtras', () => {
  it('returns ["build"] when amount >= configured build price and enabled', () => {
    expect(eligibleExtras(10, DEFAULT_EXTRAS_CONFIG)).toEqual(['build']);
    expect(eligibleExtras(100, DEFAULT_EXTRAS_CONFIG)).toEqual(['build']);
  });

  it('returns [] when amount is below the build price', () => {
    expect(eligibleExtras(5, DEFAULT_EXTRAS_CONFIG)).toEqual([]);
    expect(eligibleExtras(9.99, DEFAULT_EXTRAS_CONFIG)).toEqual([]);
  });

  it('returns [] when build extra is disabled', () => {
    const cfg = { build: { enabled: false, price: 10 } };
    expect(eligibleExtras(100, cfg)).toEqual([]);
  });

  it('returns [] when extrasConfig is missing the build key', () => {
    expect(eligibleExtras(100, {})).toEqual([]);
  });

  it('returns [] when extrasConfig is undefined', () => {
    expect(eligibleExtras(100, undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test -- extras.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `apps/web/src/services/extras.ts`**

```ts
import type { RequestExtraType, RoomExtras } from '@dbd-utils/shared';

/**
 * Returns the list of extra types whose per-room price is met by `amount`.
 * Order doesn't matter; the LLM prompt just needs to know which extras to look for.
 */
export function eligibleExtras(amount: number, config: RoomExtras | undefined): RequestExtraType[] {
  if (!config) return [];
  const out: RequestExtraType[] = [];
  if (config.build?.enabled && amount >= config.build.price) out.push('build');
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && bun run test -- extras.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/extras.ts apps/web/src/services/extras.test.ts
git commit -m "feat(web): add eligibleExtras helper"
```

---

## Task 12: `identifyMultiple` forwards extras + returns build

**Files:**
- Modify: `apps/web/src/services/llm.ts`

- [ ] **Step 1: Update `callAPI` and `identifyMultiple` signatures**

In [`apps/web/src/services/llm.ts`](apps/web/src/services/llm.ts), update the `ExtractedCharacter` type and `callAPI` body:

```ts
import type { Request, RequestExtra, RequestExtraType } from '../types';

type ExtractedCharacter = {
  character: string;
  type: string;
  matchedTerm?: string;
  build?: { text: string; matchedTerms?: string[] };
};

async function callAPI(
  message: string,
  maxCount: number,
  extras: RequestExtraType[],
  onError?: (msg: string) => void
): Promise<ExtractedCharacter[]> {
```

Inside `callAPI`, change the body to include `extras`:

```ts
      body: JSON.stringify({ message, maxCount, extras }),
```

Update existing callers of `callAPI` inside this file. There are three:
- `identifyCharacter` → pass `[]` (single-char fallback path, no extras semantics)
- `testExtraction` → pass `[]` (debug-only extraction)
- `identifyMultiple` → pass through its new `extras` parameter

Change `identifyMultiple`:

```ts
export async function identifyMultiple(
  message: string,
  maxCount: number,
  extras: RequestExtraType[] = [],
  onError?: (msg: string) => void
): Promise<Array<{
  character: string;
  type: 'survivor' | 'killer' | 'unknown' | 'none';
  matchedTerm?: string;
  extras?: RequestExtra[];
}>> {
  const isAuthenticated = useAuth.getState().isAuthenticated;
  if (!isAuthenticated) return [];
  const arr = await callAPI(message, maxCount, extras, onError);
  return arr.map(c => {
    const extrasOut: RequestExtra[] = [];
    if (c.build?.text) {
      extrasOut.push({ type: 'build', text: c.build.text, matchedTerms: c.build.matchedTerms });
    }
    return {
      character: c.character ?? '',
      type: (c.type ?? 'unknown') as 'survivor' | 'killer' | 'unknown' | 'none',
      matchedTerm: c.matchedTerm,
      extras: extrasOut.length > 0 ? extrasOut : undefined,
    };
  });
}
```

- [ ] **Step 2: Update other internal callers**

Find the existing internal `callAPI(...)` calls inside `identifyCharacter` and `testExtraction`. Update each to pass `[]` as the new 3rd argument:

```ts
// inside identifyCharacter — there are two callAPI sites:
callAPI(request.message, 1, [], onError).then(...)
// and:
const arr = await callAPI(request.message, 1, [], onError);

// inside testExtraction — also two sites:
callAPI(input, 1, [], onError).then(...)
const arr = await callAPI(input, 1, [], onError);
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Run tests**

Run: `bun run test`
Expected: PASS. No existing tests of `identifyMultiple` should break (signature change is additive with a default param).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/llm.ts
git commit -m "feat(web): identifyMultiple forwards extras and returns build per character"
```

---

## Task 13: `buildDonationRequests` carries extras

**Files:**
- Modify: `apps/web/src/services/donation.ts`
- Test: `apps/web/src/services/donation.test.ts`

- [ ] **Step 1: Write failing test**

In [`apps/web/src/services/donation.test.ts`](apps/web/src/services/donation.test.ts), add a new test:

```ts
  it('carries extras from identified entries into the produced requests', () => {
    const reqs = buildDonationRequests({
      donor: 'donor',
      amount: 'R$10',
      amountVal: 10,
      message: 'kraseu de lethal, dissolution',
      twitchMsgId: 'msg-1',
      timestampMs: Date.now(),
      identified: [
        { character: 'Krasue', type: 'killer', matchedTerm: 'kraseu', extras: [{ type: 'build', text: 'lethal, dissolution', matchedTerms: ['lethal, dissolution'] }] },
      ],
    });
    expect(reqs).toHaveLength(1);
    expect(reqs[0].extras).toEqual([
      { type: 'build', text: 'lethal, dissolution', matchedTerms: ['lethal, dissolution'] },
    ]);
  });

  it('leaves extras undefined when the identified entry has none', () => {
    const reqs = buildDonationRequests({
      donor: 'donor', amount: 'R$5', amountVal: 5, message: 'trapper', twitchMsgId: 'msg-2', timestampMs: Date.now(),
      identified: [{ character: 'Trapper', type: 'killer', matchedTerm: 'trapper' }],
    });
    expect(reqs[0].extras).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test -- donation.test.ts`
Expected: FAIL — `extras` is dropped by `buildDonationRequests`.

- [ ] **Step 3: Update `BuildInput` and the request construction**

In [`apps/web/src/services/donation.ts`](apps/web/src/services/donation.ts), update the `BuildInput.identified` type and the mapping:

```ts
import type { Request, RequestExtra } from '../types';

// …

interface BuildInput {
  donor: string;
  amount: string;
  amountVal: number;
  message: string;
  twitchMsgId: string | undefined;
  timestampMs: number;
  identified: Array<{
    character: string;
    type: 'survivor' | 'killer' | 'unknown' | 'none' | string;
    matchedTerm?: string;
    extras?: RequestExtra[];
  }>;
}
```

Then in the mapping inside `buildDonationRequests`, add `extras: c.extras` to the returned object:

```ts
  return identified.map((c, i) => {
    const fallback = `donation:${donor}:${amount}:${message}:${i}`;
    return {
      id: makeId(twitchMsgId, fallback, i),
      timestamp,
      donor,
      amount,
      amountVal,
      message,
      character: c.character || '',
      type: (c.type as Request['type']) || 'unknown',
      source: 'donation',
      needsIdentification: false,
      matchedTerm: c.matchedTerm,
      originMsgId,
      extras: c.extras,
    };
  });
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && bun run test -- donation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/donation.ts apps/web/src/services/donation.test.ts
git commit -m "feat(web): buildDonationRequests carries extras into requests"
```

---

## Task 14: Twitch donation handler computes & passes extras

**Files:**
- Modify: `apps/web/src/services/twitch.ts`

- [ ] **Step 1: Locate the donation handler and add the eligibility call**

In [`apps/web/src/services/twitch.ts`](apps/web/src/services/twitch.ts), find the multi-request donation path (around the `identifyMultiple(parsed.message, entitlement).then(...)` call near line 292).

Add an import at the top:

```ts
import { eligibleExtras } from './extras';
```

Replace the `identifyMultiple(...)` call site. The handler has access to room sources via the store; the existing code already reads `enabled.donation`, `minDonation`. Add the extras eligibility lookup just before the call.

The shape of the surrounding code (paraphrased):

```ts
identifyMultiple(parsed.message, entitlement).then(characters => {
  characters.forEach(c => {
    // builds a Request and broadcasts it
  });
});
```

Change to:

```ts
const extras = eligibleExtras(amountVal, useSources.getState().extrasConfig);

identifyMultiple(parsed.message, entitlement, extras).then(characters => {
  // …existing body unchanged…
});
```

(Use whatever local store accessor the surrounding code already uses to read sources state. If it's `getSourcesState()`, prefer that. The point is: pull `extrasConfig` from the same place `minDonation` was just read.)

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `bun run test`
Expected: PASS — no existing twitch tests cover the donation eligibility path directly; tests touch parsing, not extras wiring.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/services/twitch.ts
git commit -m "feat(web): twitch donation handler passes eligible extras to LLM"
```

---

## Task 15: SourcesStore `extrasConfig` + default-on-first-hydrate

**Files:**
- Modify: `apps/web/src/store/channel.ts`
- Test: `apps/web/src/store/channel.test.ts`

- [ ] **Step 1: Write failing test**

In [`apps/web/src/store/channel.test.ts`](apps/web/src/store/channel.test.ts), add:

```ts
  it('writes default extrasConfig on first sources hydrate when missing', () => {
    const broadcasts: Array<Record<string, unknown>> = [];
    vi.mocked(broadcastSources).mockImplementation((s) => { broadcasts.push(s as Record<string, unknown>); });

    const useSources = createSourcesStore('room', () => ({ partyConnected: true }));
    useSources.getState().handlePartyMessage({
      type: 'sync-full',
      requests: [],
      channel: { status: 'offline', owner: null },
      sources: {
        enabled: { donation: true, chat: true, resub: false, manual: true },
        chatCommand: '!fila',
        chatTiers: [2, 3],
        priority: ['donation', 'chat', 'resub', 'manual'],
        sortMode: 'fifo',
        minDonation: 5,
        // no extrasConfig
      } as SourcesSettings,
    });

    const state = useSources.getState();
    expect(state.extrasConfig).toEqual({ build: { enabled: true, price: 10 } });
    expect(broadcasts.some(b => 'extrasConfig' in b)).toBe(true);
  });

  it('keeps existing extrasConfig when present in sync-full', () => {
    const useSources = createSourcesStore('room', () => ({ partyConnected: true }));
    useSources.getState().handlePartyMessage({
      type: 'sync-full',
      requests: [],
      channel: { status: 'offline', owner: null },
      sources: {
        enabled: { donation: true, chat: true, resub: false, manual: true },
        chatCommand: '!fila',
        chatTiers: [2, 3],
        priority: ['donation', 'chat', 'resub', 'manual'],
        sortMode: 'fifo',
        minDonation: 5,
        extrasConfig: { build: { enabled: false, price: 25 } },
      },
    });
    expect(useSources.getState().extrasConfig).toEqual({ build: { enabled: false, price: 25 } });
  });
```

Make sure the file imports `SourcesSettings` and the existing mock of `broadcastSources` from `../services/party`. If the test setup uses a different harness, mirror it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun run test -- channel.test.ts`
Expected: FAIL — `extrasConfig` doesn't exist on the store.

- [ ] **Step 3: Extend the `SourcesStore` interface and `SOURCES_DEFAULTS`**

In [`apps/web/src/store/channel.ts`](apps/web/src/store/channel.ts):

Import `RoomExtras` and `DEFAULT_EXTRAS_CONFIG`:

```ts
import { MAX_PENDING_REQUESTS, DEFAULT_EXTRAS_CONFIG, type RoomExtras } from '@dbd-utils/shared';
```

Add to `SourcesStore` interface (next to `confirmInChat`):

```ts
  extrasConfig: RoomExtras;
  setExtrasConfig: (extrasConfig: RoomExtras) => void;
```

Add to `SOURCES_DEFAULTS`:

```ts
  extrasConfig: DEFAULT_EXTRAS_CONFIG,
```

Add a default in the store's `create(...)` initializer:

```ts
        extrasConfig: SOURCES_DEFAULTS.extrasConfig,
```

Add the setter:

```ts
        setExtrasConfig: (extrasConfig) => {
          set({ extrasConfig });
          maybeBroadcast(get);
        },
```

- [ ] **Step 4: Update `handlePartyMessage` to default-on-first-hydrate**

In the existing `handlePartyMessage` case for `'sync-full' | 'update-sources'`:

```ts
        handlePartyMessage: (msg) => {
          if (msg.type === 'sync-full' || msg.type === 'update-sources') {
            const sources = msg.sources;
            const incomingExtras = sources.extrasConfig;
            const extrasConfig = incomingExtras ?? DEFAULT_EXTRAS_CONFIG;

            set({
              enabled: sources.enabled,
              chatCommand: sources.chatCommand,
              chatTiers: sources.chatTiers,
              priority: sources.priority,
              sortMode: sources.sortMode,
              minDonation: sources.minDonation,
              hideNonRequests: sources.hideNonRequests ?? true,
              confirmInChat: sources.confirmInChat ?? false,
              recoveryVodId: sources.recoveryVodId,
              recoveryVodOffset: sources.recoveryVodOffset,
              extrasConfig,
            });

            // First-load default: persist the hardcoded default back so the
            // streamer's room config is no longer ambiguous.
            if (!incomingExtras) maybeBroadcast(get);
          }
        },
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && bun run test -- channel.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/store/channel.ts apps/web/src/store/channel.test.ts
git commit -m "feat(web): SourcesStore extrasConfig with default-on-first-hydrate"
```

---

## Task 16: `BuildBadge` component

**Files:**
- Create: `apps/web/src/components/BuildBadge.tsx`

- [ ] **Step 1: Implement the badge**

Create [`apps/web/src/components/BuildBadge.tsx`](apps/web/src/components/BuildBadge.tsx):

```tsx
import type { CSSProperties } from 'react';

const base = import.meta.env.BASE_URL;
const perkSlot = `${base}images/perk.webp`;

interface Props {
  size?: 'sm' | 'md';
}

/**
 * Four empty perk slots arranged in the canonical DBD loadout diamond:
 *
 *      ●
 *    ●   ●
 *      ●
 *
 * Renders bottom-right of the avatar. Tooltip is provided by the parent
 * (CharacterAvatar) listening for pointer/touch events on the entire
 * avatar wrapper, so this component is purely visual.
 */
export function BuildBadge({ size = 'md' }: Props) {
  const sizeClass = size === 'sm' ? 'build-badge-sm' : '';
  const slotStyle: CSSProperties = { backgroundImage: `url('${perkSlot}')` };

  return (
    <div className={`build-badge ${sizeClass}`} aria-hidden="true">
      <span className="build-badge-slot build-badge-top" style={slotStyle} />
      <span className="build-badge-slot build-badge-left" style={slotStyle} />
      <span className="build-badge-slot build-badge-right" style={slotStyle} />
      <span className="build-badge-slot build-badge-bottom" style={slotStyle} />
    </div>
  );
}
```

Note: this references `apps/web/public/images/perk.webp`, which the spec assumes already exists. If it doesn't, the badge will render empty diamond shapes (still acceptable as an indicator), and the asset can be added separately.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Verify `perk.webp` exists**

Run: `ls apps/web/public/images/perk.webp`
Expected: file exists. If not, stop and ask the user where the asset should come from before continuing — do not fabricate one.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/BuildBadge.tsx
git commit -m "feat(web): BuildBadge component (4 empty perk slots)"
```

---

## Task 17: `CharacterAvatar` renders badge + tooltip handlers

**Files:**
- Modify: `apps/web/src/components/CharacterAvatar.tsx`

- [ ] **Step 1: Extend props with `extras` and add tooltip state**

Replace the entire contents of [`apps/web/src/components/CharacterAvatar.tsx`](apps/web/src/components/CharacterAvatar.tsx) with:

```tsx
import { useState, useRef, useEffect } from 'react';
import type { RequestExtra } from '../types';
import { BuildBadge } from './BuildBadge';

interface Props {
  portrait?: string;
  type: string;
  size?: 'sm' | 'md';
  extras?: RequestExtra[];
}

const base = import.meta.env.BASE_URL;
const portraitBg = `url('${base}images/CharPortrait_bg.webp')`;
const roleBg = `url('${base}images/CharPortrait_roleBG.webp')`;

function getBuild(extras?: RequestExtra[]): { text: string } | null {
  if (!extras) return null;
  const b = extras.find(e => e.type === 'build');
  return b ? { text: b.text } : null;
}

export function CharacterAvatar({ portrait, type, size = 'md', extras }: Props) {
  const sizeClass = size === 'sm' ? 'char-portrait-sm' : '';
  const build = getBuild(extras);
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Tap-away dismissal (mobile)
  useEffect(() => {
    if (!showTooltip) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showTooltip]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!build) return;
    // Suppress the card's done-toggle for this tap.
    e.stopPropagation();
    setShowTooltip(prev => !prev);
  };

  const handleMouseEnter = () => { if (build) setShowTooltip(true); };
  const handleMouseLeave = () => { setShowTooltip(false); };

  const innerProps = {
    ref: wrapperRef,
    onTouchStart: handleTouchStart,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  if (type === 'killer' && portrait) {
    return (
      <div className={`char-portrait-wrapper ${sizeClass}`} style={{ backgroundImage: portraitBg }} {...innerProps}>
        <div className="char-portrait-bg killer" style={{ WebkitMaskImage: roleBg, maskImage: roleBg }}></div>
        <img src={portrait} alt="" className="char-portrait" />
        {build && <BuildBadge size={size} />}
        {build && showTooltip && <div className="build-tooltip" role="tooltip">{build.text}</div>}
      </div>
    );
  }

  const placeholderIcon = type === 'killer' ? 'IconKiller.webp' :
                          type === 'survivor' ? 'IconSurv.webp' :
                          'IconShuffle.webp';
  const placeholder = `${base}images/${placeholderIcon}`;
  return (
    <div className={`char-portrait-wrapper char-portrait-placeholder ${sizeClass}`} style={{ backgroundImage: portraitBg }} {...innerProps}>
      <img src={placeholder} alt="" className="char-portrait" />
      {build && <BuildBadge size={size} />}
      {build && showTooltip && <div className="build-tooltip" role="tooltip">{build.text}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/CharacterAvatar.tsx
git commit -m "feat(web): CharacterAvatar renders BuildBadge + tooltip"
```

---

## Task 18: `CharacterRequestCard` passes extras and uses `highlightTerms`

**Files:**
- Modify: `apps/web/src/components/CharacterRequestCard.tsx`

- [ ] **Step 1: Replace local `highlightTerm` with imported `highlightTerms`**

In [`apps/web/src/components/CharacterRequestCard.tsx`](apps/web/src/components/CharacterRequestCard.tsx):

Delete the local `highlightTerm` function (the one defined at the top of the file). Replace its import:

```ts
import { highlightTerms } from '../utils/helpers';
```

(adjust path: the existing import for `formatRelativeTime` is `'../utils/helpers'`, so the new import joins that line — combine into a single import if `formatRelativeTime` is already imported from there.)

Replace the existing `getMatchedTerm`/highlight resolution. Inside the component body, near the existing `const matchedTerm = useMemo(...)`, add:

```tsx
  const buildMatchedTerms = useMemo(() => {
    const build = r.extras?.find(e => e.type === 'build');
    return build?.matchedTerms ?? [];
  }, [r.extras]);

  const allTerms = useMemo(() => {
    const terms: string[] = [];
    if (matchedTerm) terms.push(matchedTerm);
    terms.push(...buildMatchedTerms);
    return terms;
  }, [matchedTerm, buildMatchedTerms]);
```

Find the render line that previously read `{matchedTerm ? highlightTerm(r.message, matchedTerm) : r.message}` and replace with:

```tsx
            {allTerms.length > 0 ? highlightTerms(r.message, allTerms) : r.message}
```

- [ ] **Step 2: Pass `extras` to `CharacterAvatar`**

Find the existing `<CharacterAvatar ... />` usage and add the `extras={r.extras}` prop.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Run tests**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/CharacterRequestCard.tsx
git commit -m "feat(web): CharacterRequestCard wires extras into avatar + highlights"
```

---

## Task 19: Settings UI — Extras row inside Donations

**Files:**
- Create: `apps/web/src/components/settings/ExtraRow.tsx`
- Modify: `apps/web/src/components/settings/SourcesSection.tsx`

- [ ] **Step 1: Create `ExtraRow`**

Create [`apps/web/src/components/settings/ExtraRow.tsx`](apps/web/src/components/settings/ExtraRow.tsx):

```tsx
import { useTranslation } from '../../i18n';
import { Toggle } from './Toggle';
import { EditableField } from './EditableField';
import type { RequestExtraType, ExtraConfig } from '@dbd-utils/shared';

interface Props {
  extra: RequestExtraType;
  config: ExtraConfig;
  minDonation: number;
  readOnly: boolean;
  onChange: (config: ExtraConfig) => void;
}

const LABEL_KEYS: Record<RequestExtraType, { name: 'extras.build.name'; desc: 'extras.build.desc' }> = {
  build: { name: 'extras.build.name', desc: 'extras.build.desc' },
};

export function ExtraRow({ extra, config, minDonation, readOnly, onChange }: Props) {
  const { t } = useTranslation();
  const keys = LABEL_KEYS[extra];

  return (
    <div className={`extra-row ${config.enabled ? 'enabled' : 'disabled'}`} data-extra={extra}>
      <div className="extra-row-header">
        <span className="extra-row-name">{t(keys.name)}</span>
        <Toggle
          checked={config.enabled}
          onClick={() => !readOnly && onChange({ ...config, enabled: !config.enabled })}
          disabled={readOnly}
          aria-label={t(keys.name)}
        />
      </div>
      <p className="extra-row-desc">{t(keys.desc)}</p>
      <div className="extra-row-config">
        <EditableField
          label={t('sources.minimum')}
          displayValue={`R$ ${config.price}`}
          disabled={readOnly}
        >
          <div className="settings-field-prefix">
            <span>R$</span>
            <input
              id={`extra-${extra}-price`}
              name={`extra-${extra}-price`}
              type="number"
              defaultValue={config.price}
              min={minDonation}
              step={1}
              onBlur={e => {
                if (readOnly) return;
                const parsed = parseFloat(e.target.value);
                const clamped = Math.max(minDonation, Number.isFinite(parsed) ? parsed : minDonation);
                onChange({ ...config, price: clamped });
                e.target.value = String(clamped);
              }}
              disabled={readOnly}
            />
          </div>
        </EditableField>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `SourcesSection`**

Edit [`apps/web/src/components/settings/SourcesSection.tsx`](apps/web/src/components/settings/SourcesSection.tsx).

Add at the top:

```tsx
import { ExtraRow } from './ExtraRow';
import { DEFAULT_EXTRAS_CONFIG, type RequestExtraType } from '@dbd-utils/shared';

const ENABLED_EXTRAS: RequestExtraType[] = ['build'];
```

In the `useSources()` destructure, add `extrasConfig` and `setExtrasConfig`:

```tsx
  const {
    enabled, chatCommand, chatTiers, minDonation, extrasConfig,
    setEnabled, setChatCommand, setChatTiers, setMinDonation, setExtrasConfig,
  } = useSources();
```

Inside the `source === 'donation'` block, after the existing `<EditableField>` that handles `min_donation`, append the extras list (still inside the donation row, after the closing `</EditableField>` and `</div>`):

```tsx
                <div className="source-row-extras">
                  {ENABLED_EXTRAS.map(extra => {
                    const cfg = extrasConfig?.[extra] ?? DEFAULT_EXTRAS_CONFIG[extra]!;
                    return (
                      <ExtraRow
                        key={extra}
                        extra={extra}
                        config={cfg}
                        minDonation={minDonation}
                        readOnly={readOnly}
                        onChange={(next) => setExtrasConfig({ ...(extrasConfig ?? {}), [extra]: next })}
                      />
                    );
                  })}
                </div>
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/settings/ExtraRow.tsx apps/web/src/components/settings/SourcesSection.tsx
git commit -m "feat(web): Settings UI — Extras (Build requests) row under Donations"
```

---

## Task 20: i18n labels

**Files:**
- Modify: `apps/web/src/i18n/locales/en.ts`
- Modify: `apps/web/src/i18n/locales/pt-BR.ts`

- [ ] **Step 1: Add EN keys**

In [`apps/web/src/i18n/locales/en.ts`](apps/web/src/i18n/locales/en.ts), add (near the existing `'sources.*'` keys):

```ts
  'extras.build.name': 'Build requests',
  'extras.build.desc': 'Donors above this amount can include a build (perks/addons) with their request.',
```

- [ ] **Step 2: Add PT-BR keys**

In [`apps/web/src/i18n/locales/pt-BR.ts`](apps/web/src/i18n/locales/pt-BR.ts):

```ts
  'extras.build.name': 'Pedidos com build',
  'extras.build.desc': 'Doadores acima desse valor podem incluir uma build (perks/addons) no pedido.',
```

- [ ] **Step 3: Verify i18n test still passes**

Run: `cd apps/web && bun run test -- i18n.test.ts`
Expected: PASS. If the test asserts key parity between locales, both locales now have the new keys.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/i18n/locales/en.ts apps/web/src/i18n/locales/pt-BR.ts
git commit -m "feat(web): i18n labels for extras / build requests"
```

---

## Task 21: CSS — badge, tooltip, extras-row

**Files:**
- Modify: `apps/web/src/styles/requests.css`
- Modify: `apps/web/src/styles/settings-panel.css`

- [ ] **Step 1: Add badge + tooltip styles**

Append to [`apps/web/src/styles/requests.css`](apps/web/src/styles/requests.css):

```css
/* ---------- Build badge (4-slot perk indicator on avatar) ---------- */
.build-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 40%;
  aspect-ratio: 1;
  pointer-events: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
  z-index: 2;
}

.build-badge-slot {
  position: absolute;
  width: 50%;
  height: 50%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.build-badge-top    { top: 0;    left: 25%; }
.build-badge-left   { top: 25%;  left: 0; }
.build-badge-right  { top: 25%;  right: 0; }
.build-badge-bottom { bottom: 0; left: 25%; }

.build-badge-sm {
  width: 50%;
  bottom: -2px;
  right: -2px;
}

.build-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(20, 18, 22, 0.96);
  color: #f3f1ef;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.8rem;
  line-height: 1.35;
  max-width: 280px;
  width: max-content;
  pointer-events: none;
  white-space: normal;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}

@media (max-width: 640px) {
  .build-tooltip {
    max-width: 220px;
    font-size: 0.78rem;
  }
}
```

- [ ] **Step 2: Add extras-row styles**

Append to [`apps/web/src/styles/settings-panel.css`](apps/web/src/styles/settings-panel.css):

```css
/* ---------- Donation extras (build requests, etc.) ---------- */
.source-row-extras {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.extra-row {
  padding-left: 10px;
  border-left: 2px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extra-row.disabled { opacity: 0.65; }

.extra-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.extra-row-name {
  font-weight: 600;
  font-size: 0.92rem;
}

.extra-row-desc {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.65);
}

.extra-row-config {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/requests.css apps/web/src/styles/settings-panel.css
git commit -m "feat(web): styles for build badge, tooltip, and extras settings row"
```

---

## Task 22: Demo mocks include a build

**Files:**
- Modify: `apps/web/src/data/mock-requests.ts`

- [ ] **Step 1: Read the existing mocks**

Read [`apps/web/src/data/mock-requests.ts`](apps/web/src/data/mock-requests.ts) and pick one killer entry to enrich (e.g. the first donation-source mock).

- [ ] **Step 2: Attach a `build` extra to one entry**

Modify the chosen entry to add:

```ts
    extras: [{
      type: 'build',
      text: 'lethal, dissolution, bambas e bbq · addons cabeça de galinha e olho de porco',
      matchedTerms: ['lethal, dissolution, bambas e bbq', 'cabeça de galinha e olho de porco'],
    }],
```

Also include the corresponding text inside the entry's `message` field so the highlight has something to land on, e.g.:

```ts
    message: 'Joga uma de Krasue de lethal, dissolution, bambas e bbq, cabeça de galinha e olho de porco de addon',
```

If the existing mock already references "Krasue" differently, keep the character and message consistent — the point is one demo with a visible build.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/data/mock-requests.ts
git commit -m "feat(web): demo mock with a build extra"
```

---

## Task 23: Re-identify-all path passes extras

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Find the re-identify loop**

Search `apps/web/src/App.tsx` for the existing handler that iterates over current requests and calls `identifyMultiple` or `identifyCharacter` per row (the Debug → "Re-identify all" action wired from the DebugPanel).

- [ ] **Step 2: Compute and pass extras per row**

Where the loop body calls the LLM, wrap each call with the eligibility helper:

```ts
import { eligibleExtras } from './services/extras';

// inside the loop:
const extras = eligibleExtras(req.amountVal, sourcesState.extrasConfig);
const result = await identifyMultiple(req.message, 1, extras);
const c = result[0];
update(req.id, {
  character: c.character,
  type: c.type,
  matchedTerm: c.matchedTerm,
  extras: c.extras,
});
```

If the current code calls `identifyCharacter` (the single-character helper), prefer keeping that for the character side and additionally call `identifyMultiple` only when `extras.length > 0` — but the simpler edit is to switch to `identifyMultiple(req.message, 1, extras)` everywhere in this loop so build extras come back out of the same call when eligible. Match the existing surrounding style.

- [ ] **Step 3: Typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): re-identify-all passes eligible extras per row"
```

---

## Task 24: Eval cases for build extraction

**Files:**
- Modify: `apps/api/src/gemini.eval.test.ts`

- [ ] **Step 1: Add build-extraction cases (live eval, skipped in CI)**

In [`apps/api/src/gemini.eval.test.ts`](apps/api/src/gemini.eval.test.ts), add a new `describe.skipIf(!process.env.GEMINI_API_KEY)('builds', () => { ... })` block (or extend the existing structure — match what's already there).

Cases:

```ts
  it.skipIf(!process.env.GEMINI_API_KEY)('extracts a fully specified killer build', async () => {
    const res = await extractCharacters(
      'puxa uma kraseu pa tropa, lindão. lethal, dissolution, bambas e bbq. cabeça de galinha e olho de porco de addon pro churras. amo vc tmj',
      process.env.GEMINI_API_KEY!,
      3,
      ['build']
    );
    expect(res).toHaveLength(1);
    expect(res[0].character.toLowerCase()).toContain('krasue');
    expect(res[0].build?.text).toBeTruthy();
    expect((res[0].build?.matchedTerms?.length ?? 0)).toBeGreaterThanOrEqual(1);
    // Each matched term must be a substring of the original message.
    for (const t of res[0].build!.matchedTerms!) {
      expect(originalMessage(res[0]).toLowerCase()).toContain(t.toLowerCase());
    }
  });

  it.skipIf(!process.env.GEMINI_API_KEY)('extracts a survivor build', async () => {
    const res = await extractCharacters(
      'Mainha estou pedindo a buildas de surv. Perk se totem da jill valentine Perk sensorial da eleven Perk de cura da Nancy Perk da hady kour',
      process.env.GEMINI_API_KEY!,
      4,
      ['build']
    );
    const withBuild = res.filter(r => r.build);
    expect(withBuild.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!process.env.GEMINI_API_KEY)('extracts a themed build', async () => {
    const res = await extractCharacters('Doctor de build irritante', process.env.GEMINI_API_KEY!, 1, ['build']);
    expect(res).toHaveLength(1);
    expect(res[0].character.toLowerCase()).toContain('doctor');
    expect(res[0].build?.text?.toLowerCase()).toContain('irritante');
  });

  it.skipIf(!process.env.GEMINI_API_KEY)('attaches same build to quantified characters', async () => {
    const res = await extractCharacters('3 trickster de build de aura', process.env.GEMINI_API_KEY!, 5, ['build']);
    expect(res).toHaveLength(3);
    for (const r of res) {
      expect(r.character.toLowerCase()).toContain('trickster');
      expect(r.build?.text).toBeTruthy();
    }
  });

  it.skipIf(!process.env.GEMINI_API_KEY)('attaches different builds per character', async () => {
    const res = await extractCharacters('Pig de aura e Hag de gritos', process.env.GEMINI_API_KEY!, 2, ['build']);
    expect(res).toHaveLength(2);
    const pig = res.find(r => r.character.toLowerCase().includes('pig'));
    const hag = res.find(r => r.character.toLowerCase().includes('hag'));
    expect(pig?.build?.text?.toLowerCase()).toContain('aura');
    expect(hag?.build?.text?.toLowerCase()).toContain('grito');
  });

  it.skipIf(!process.env.GEMINI_API_KEY)('captures a no-perk build', async () => {
    const res = await extractCharacters('hag sem perks', process.env.GEMINI_API_KEY!, 1, ['build']);
    expect(res).toHaveLength(1);
    expect(res[0].build?.text?.toLowerCase()).toContain('sem perks');
  });
```

Note: `originalMessage(res[0])` is a placeholder for whatever pattern the existing eval file uses to access the test input. Inline the message string for the substring check, or remove that assertion and just check that `matchedTerms` is non-empty.

- [ ] **Step 2: Run the eval suite on demand (optional, requires API key)**

Run: `cd apps/api && set -a && source .env && set +a && bun run test:eval`
Expected: All new tests pass (live calls to Gemini). Skip this step if no `.env` is present; the suite is gated by `GEMINI_API_KEY`.

- [ ] **Step 3: Run normal tests**

Run: `bun run test`
Expected: PASS. Eval cases are skipped without the env var.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/gemini.eval.test.ts
git commit -m "test(api): eval cases for build extraction (killer, survivor, themed, multi-char, no-perk)"
```

---

## Task 25: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Full typecheck**

Run: `bun run typecheck`
Expected: PASS across all packages.

- [ ] **Step 2: Full test suite**

Run: `bun run test`
Expected: All unit tests pass. Eval suite skipped in CI mode.

- [ ] **Step 3: Boot the dev server and smoke-test the UI**

Use the preview tools (per the system's preview workflow):

1. `preview_start` for the web app.
2. Open the channel (use the demo mock with a build, or fire a debug donation: in the browser console, run `dbdDebug.donate('TestDonor', 15, 'joga de kraseu de lethal, dissolution, bambas e bbq, cabeça de galinha e olho de porco de addon')`).
3. `preview_snapshot` to confirm the request lands in the queue.
4. `preview_screenshot` to confirm: badge visible on the avatar, build text highlighted inside the donor message.
5. Hover the avatar (`preview_inspect` for CSS; or `preview_eval` to simulate `mouseenter`). Confirm tooltip appears.
6. `preview_resize` to a mobile size; tap simulation via `preview_click` on the avatar; confirm tooltip toggles without marking the card done.
7. Open Settings → Donations; confirm the "Build requests" row appears with `R$ 10` as the price.
8. `preview_console_logs` to verify no errors.

- [ ] **Step 4: Verify D1 schema applied locally**

Run: `cd apps/api && bunx wrangler d1 execute fila-dbd --local --command "PRAGMA table_info(requests); PRAGMA table_info(rooms);"`
Expected: `extras` column on `requests`, `extras_config` column on `rooms`.

- [ ] **Step 5: Commit any incidental fixes if needed and prepare PR description**

If steps 1–4 revealed small issues (typos, CSS tweaks), fix and commit them with appropriate commit messages, then re-run verification.

- [ ] **Step 6: Apply migration to production D1 when ready to ship**

The actual deploy step (do not run without user approval):

```bash
cd apps/api && bunx wrangler d1 migrations apply fila-dbd --remote --env production
bun run deploy:api
bun run deploy:party
# Frontend deploys via Pages on main merge — leave that to the existing pipeline.
```

This step is documentation, not a step to auto-execute.

---

## Self-review

**Spec coverage:**

- §1 Data shape → Tasks 1–3
- §2 LLM extraction → Tasks 4, 5, 11, 12, 14, 23
- §3 Settings UI → Tasks 15, 19, 20, 21
- §4 Badge / highlight → Tasks 10, 16, 17, 18, 21, 22
- §5 Release impact / sync → Tasks 6, 7, 8, 9, 25

**Placeholder scan:** No "TBD" / "TODO" / vague language. Every step has either code or an exact command. The two soft spots are flagged inline (`originalMessage(...)` placeholder in eval; the surrounding-style match in Task 23) — these tell the implementor to read the existing file and mirror its style rather than fabricate one.

**Type consistency:**

- `RequestExtraType` / `RequestExtra` / `RoomExtras` / `ExtraConfig` defined in Task 1, used unchanged in Tasks 2, 4, 5, 11–15, 17–19.
- `extrasConfig` (camelCase) is consistently the TS field name (Tasks 2, 6, 14, 15, 19, 23). `extras_config` (snake_case) only appears as a D1 column name (Tasks 3, 6, 8).
- `request.extras: RequestExtra[]` (instance) vs `sources.extrasConfig: RoomExtras` (config) — distinct fields, consistent throughout.
- `BUILD_DEFAULT_PRICE = 10` and `DEFAULT_EXTRAS_CONFIG` defined in Task 1, used in Tasks 11 (default for tests), 15 (default-on-hydrate), 19 (fallback in render).
- `highlightTerms(message, terms)` defined in Task 10, used in Task 18.

**Frequent commits:** Every task commits at the end; many tasks split test-write and impl into separate steps but commit together to keep history readable.

No issues. Plan is complete.
