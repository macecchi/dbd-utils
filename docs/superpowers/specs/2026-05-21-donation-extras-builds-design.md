# Donation extras: build requests

**Status:** Design approved 2026-05-21
**Scope:** First instance of a generic "donation extras" system. Ships with a single extra type — `build` — usable for both killer and survivor requests.

## Problem

Donors frequently include loadout instructions ("joga de Krasue com lethal, dissolution, bambas e bbq, addons cabeça de galinha e olho de porco") in their donation messages. Today these are stored as raw `message` text, identified only by character name. The streamer has no visual cue that a build was requested, and no compact way to recall what was asked for.

A scan of MandyMess's production donations (840 rows) shows roughly one in four high-value donations carries some build hint, in three loose flavours: **fully specified** (4 perks + 2 addons named), **themed** ("build de aura", "build irritante"), and **partial** (one or two perks/addons). Vocabulary mixes English official names, Portuguese localizations, and community slang.

## Goals

- Detect build requests on donations above a per-streamer price threshold.
- Capture whatever the donor wrote about the build (free-text), without committing to a canonical perk/addon database.
- Surface the build in the queue UI without crowding the existing card: a badge on the avatar (4 empty perk slots) plus inline highlighting of the build span in the donor message.
- Model the feature as the first instance of a generic "request extras" system so future products (custom challenges, map offerings, etc.) plug in without schema churn.

## Non-goals

- Per-perk icons or a curated perk/addon database.
- Builds on resub / chat / manual sources.
- Automatic backfill of existing rows on deploy.
- Bot confirmation message changes.
- Multiple build extras on a single request.

---

## 1. Data shape

### Generic "extras" abstraction

A donation flow has three pricing layers:

| Layer | Setting | Meaning |
|---|---|---|
| Floor | `min_donation` | Below this → ignored. Above → enters queue. |
| Extras | per-extra `price` | If `amount ≥ extra.price`, the donor may also include that extra. |

Extras are **independent unlocks**, not additive. Each extra has its own price. A donation that clears multiple thresholds may carry multiple extras.

### Type model

In `packages/shared/src/types.ts`:

```ts
export type RequestExtraType = 'build';   // union grows later

export type RequestExtra =
  | { type: 'build'; text: string; matchedTerms?: string[] };

export interface Request {
  // …existing fields…
  extras?: RequestExtra[];   // 0–N extras attached
}

export interface ExtraConfig {
  enabled: boolean;
  price: number;
}

export interface RoomExtras {
  build?: ExtraConfig;
}
```

`extras` is optional. Absent and empty array are equivalent for rendering purposes.

The `build` extra stores:
- `text` — short human-readable summary of the loadout, in the donor's language. May be verbatim or lightly tidied; preserves slang.
- `matchedTerms` — array of exact substrings of the original message that describe the build (perks and addons are often split into separate clauses). Used for inline highlighting. Optional; absence means "no highlight, tooltip only".

### D1 migration `apps/api/migrations/0007_add_extras.sql`

```sql
ALTER TABLE requests ADD COLUMN extras TEXT;        -- JSON array of RequestExtra, nullable
ALTER TABLE rooms    ADD COLUMN extras_config TEXT; -- JSON object of RoomExtras, nullable
```

Both stored as JSON strings, matching `chat_tiers` and `priority` on `rooms`. The union grows by code change, not schema change. `NULL` means "use defaults".

### PartyKit storage

Builds ride inline on the existing per-key `req:${id}` serialized value. No new keys, no DO schema change. `serializeRequest` writes `extras` only when present; `deserializeRequest` tolerates absence. Survives rolling deploys (additive optional field).

### Default config

`BUILD_DEFAULT_PRICE = 10`. When a room is loaded and its `extras_config` is `NULL` or missing the `build` key, the frontend writes `{ build: { enabled: true, price: 10 } }` to `extras_config` and persists it via the normal room sync. From then on it's a regular persisted value.

---

## 2. LLM extraction

### Where eligibility is decided

The frontend (`apps/web/src/services/llm.ts`) gates extras based on amount and room config:

```ts
function eligibleExtras(amount: number, config: RoomExtras): RequestExtraType[] {
  const out: RequestExtraType[] = [];
  if (config.build?.enabled && amount >= config.build.price) out.push('build');
  return out;
}
```

No keyword pre-filter. The LLM call already happens on every donation as the async refinement pass — gating extras on amount only adds the appropriate instructions to that existing call.

The eligibility check lives in a single helper consumed by both code paths:
1. Initial donation extraction (`twitch.ts` donation handler → `llm.ts`).
2. Debug → "Re-identify all" loop, which iterates existing rows.

Because re-identify uses the same helper with each row's `amountVal` against the current `extras_config`, clicking it on an old room will populate `extras` for any historically eligible donations. This is intentional and zero-extra-code: it gives the streamer a manual backfill path without an automatic one.

### Backend prompt

`/llm/extract` (POST in `apps/api/src/index.ts`) accepts a new optional body field:

```ts
{ message: string; maxCount: number; extras?: RequestExtraType[] }
```

When `extras` is absent or empty, the prompt is byte-identical to today — no token regression on plain donations.

When `extras` includes `'build'`, the existing prompt in `gemini.ts` gets this addendum:

```
For each character entry, also try to identify a "build" the donor wants for
that character. A build is a description of the loadout the streamer should
equip — it may include perk names (DBD has hundreds, in English or Portuguese
with creative spellings and slang), addon names, item or item-addon names
(survivor loadouts), a theme like "build de aura" / "build irritante" /
"build de endgame", or an explicit "no perks" / "sem perks" instruction.

Builds apply equally to killer and survivor character entries.

If the message contains build text, attach it to the appropriate character(s):
- "Pig e Hag de build de aura" → same build text on both rows.
- "Pig de aura e Hag de gritos" → different build text per row.
- "3 trickster de build X" → same build on all three quantified rows.
- If a build is mentioned but it's unclear which character it belongs to,
  attach it to the first character entry.

Return build as { text, matchedTerms[] }:
- text: brief human-readable summary, in the donor's language (verbatim is
  fine; clean up obvious typos but keep the donor's wording/slang).
- matchedTerms: array of exact substrings of <user_message> that describe
  the build. Perks and addons may be separated by other words — include
  each contiguous span as a separate entry.

Omit the build field when no build text is present.
```

Gemini `responseSchema` is extended with an optional `build` object per character entry. Schema extension only happens when `extras` is requested.

### Mapping LLM output to `Request.extras`

In the frontend, after extraction:

```ts
const extras: RequestExtra[] = [];
if (extracted.build?.text) {
  extras.push({
    type: 'build',
    text: extracted.build.text,
    matchedTerms: extracted.build.matchedTerms,
  });
}
```

When `extras.length > 0`, attach to the `Request`.

### Eval coverage (`apps/api/src/gemini.eval.test.ts`)

Existing live evals against Gemini stay skipped in CI; build cases added to the on-demand suite, sampled from real production messages:

- **Fully specified killer build:** "puxa uma kraseu pa tropa, lindão. lethal, dissolution, bambas e bbq. cabeça de galinha e olho de porco de addon pro churras" → 1× Krasue, build present, ≥2 `matchedTerms` spans (perks + addons clauses).
- **Survivor build:** Ravioly's "buildas de surv. Perk se totem da jill valentine, Perk sensorial da eleven..." → at least one survivor entry with build text and matched terms.
- **Themed build:** "Doctor de build irritante" → 1× Doctor, `text: "build irritante"`.
- **Multi-char same theme:** "3 trickster de build de aura" → 3× Trickster, all carrying the same build.
- **Multi-char different builds:** "Pig de aura e Hag de gritos" → Pig with "build de aura", Hag with "build de gritos".
- **No-perk:** "hag sem perks" → 1× Hag, build text indicating no perks.

Assertions: character set compared as multiset (existing convention); for builds, assert `text` is non-empty and each `matchedTerm` is a substring of the original message (no exact-string match on `text`, since LLM phrasing varies).

---

## 3. Settings UI

### Placement

Inside the existing Donations panel (`apps/web/src/components/settings/` — or `SettingsPanel.tsx`), nested under the `min_donation` input. Extras are paid add-ons to donations, not a sibling source.

### Layout (one row per known extra)

```
┌─ Donations ───────────────────────────────────┐
│ ☑ Enabled                                     │
│   Minimum amount    [ R$ 5.00 ]               │
│                                               │
│   ─ Extras ─────────────────────────────────  │
│   ☑ Build requests                            │
│      Minimum amount    [ R$ 10.00 ]    ⓘ      │
│      Donors above this amount can include a   │
│      build (perks/addons) with their request. │
└───────────────────────────────────────────────┘
```

### Component shape

```tsx
const ENABLED_EXTRAS: RequestExtraType[] = ['build'];

{ENABLED_EXTRAS.map(extra => (
  <ExtraRow key={extra} extra={extra} config={room.extrasConfig?.[extra]} onChange={updateExtra} />
))}
```

`ExtraRow` handles label, toggle, price input, validation, i18n. Adding a future extra means appending to `ENABLED_EXTRAS` plus new i18n entries — no new component scaffolding.

### i18n labels

- EN: "Build requests" / "Donors above this amount can include a build (perks/addons) with their request."
- PT-BR: "Pedidos com build" / "Doadores acima desse valor podem incluir uma build (perks/addons) no pedido."

### Validation

- `price >= min_donation` (clamped on blur with an inline hint).
- `price > 0`.
- Toggle off keeps the price value (inactive); re-enabling restores it.

### Persistence

`extras_config` rides the same immediate (non-debounced) write-through path as other source/status settings via PartyKit → Worker → D1.

---

## 4. UI — badge and message highlight

### Badge — 4-slot perk indicator

A small chip pinned to the **bottom-right** of the avatar. Renders only when `request.extras` contains a `build` entry.

- **Visual:** four `perk.webp` slot icons arranged in the DBD loadout diamond (1 top / 2 middle / 1 bottom). Empty slots — we store free-text only, no per-slot artwork.
- **Sizes:** matches `CharacterAvatar`'s `md` / `sm` variants. `sm` clamps to a minimum readable size in the queue list.
- **Position:** absolute inside `char-portrait-wrapper`. Top-right stays for the source-icon chip; bottom-right belongs to the build badge.
- **Renders on all character types:** killer portrait, survivor placeholder, unidentified shuffle icon — the badge is a property of the request, not its character type.

### Tooltip interaction

- **Desktop:** hover anywhere on the avatar → tooltip shows `extras[0].text`. Click-through still marks the card done (hover ≠ click).
- **Mobile:** tap anywhere on the avatar → tooltip shows; the tap is consumed (does not toggle done). Taps elsewhere on the card mark done as today.
- Tap-away dismisses the tooltip.
- Touch handlers `stopPropagation()` only when the request has a `build` extra; otherwise pointer events bubble through and the card behaves identically to today.
- Tooltip: small dark popover, max-width ~280px, wraps long descriptions.

### Inline message highlight

The card already runs `highlightTerm(message, matchedTerm)` for the character match. Generalize to a single helper accepting plain strings:

```ts
function highlightTerms(message: string, terms: string[]): ReactNode[]
```

Card collects all terms in one array:

```ts
const terms = [
  ...(matchedTerm ? [matchedTerm] : []),
  ...(buildMatchedTerms ?? []),
];
```

All matches wrapped in `<mark className="matched-term">` — single visual treatment for both character and build highlights. Resolver picks the longest set of non-overlapping spans; if a build term overlaps the character term, the character term wins and the build span splits around it.

### Where the build text appears

Three surfaces only:

1. Badge tooltip (canonical).
2. Inline message highlights.
3. **Nowhere else.** No extra row in the card, no dedicated label. Two cues are enough.

### Demo update

`apps/web/src/data/mock-requests.ts` gets at least one mock with a `build` extra (killer) so the landing page demo shows the badge.

---

## 5. Release impact, sync, rollout

### Compatibility matrix

| Surface | Change | Old data / old clients |
|---|---|---|
| D1 `requests.extras` | New nullable JSON column | Old rows read as `NULL` → `extras = undefined` → no badge |
| D1 `rooms.extras_config` | New nullable JSON column | Frontend writes default on first load |
| DO storage `req:${id}` | Optional `extras` field added to payload | Old payloads have no field; new client renders no badge |
| Worker `/llm/extract` | Optional `extras` body field | Absent = unchanged behavior |
| Internal Worker endpoints | Accept optional JSON fields | Missing fields silently default to `NULL` |
| `PROTOCOL_VERSION` | **No bump required** — all changes additive optional | Old + new clients interop in either direction |
| `localStorage`, KV | Untouched | — |

### Deploy order

No strict ordering. All changes are additive and forward/backward compatible.

1. `wrangler d1 migrations apply fila-dbd --env production` (applies `0007_add_extras.sql`).
2. `bun run deploy:api` and `bun run deploy:party` in either order.
3. Frontend deploys via Cloudflare Pages on main merge.

If a step rolls back, the others continue functioning. The new badge simply won't render until the frontend ships.

### D1 batch-size note

Existing limit is 100 bound params per statement; we add 1 column to `requests` and 1 to `rooms`. Per-row params increase by 1; well within budget.

### Streamer action required

None. The default extras config persists silently on first room load.

### Telemetry

Existing `[extract]` logs in `gemini.ts` extend their per-call log line to include the requested extras list. No new metrics infrastructure.

---

## Open implementation notes

- The discriminated-union shape for `RequestExtra` means rendering branches on `extra.type`. For this release there's one branch (build). A small helper `getBuildExtra(extras)` or similar isolates the lookup so consumers don't switch on the union shape directly.
- The `extras_config` JSON column means the frontend must JSON.parse on read and JSON.stringify on write at the Worker boundary, matching how `chat_tiers` and `priority` are handled today.
- Validation note: PartyKit's room state update must accept the `extras_config` field and pass it through immediately, not via the 10s debounced requests path.

## Out of scope (explicit)

- Per-perk icons / canonical perk DB.
- Survivor item / item-addon slot rendering (we render 4 perk slots only; item info lives inside the free-text `build.text`).
- Builds on resub / chat / manual sources.
- Automatic backfill on deploy.
- Bot confirmation message changes.
- Multiple extras of the same type on one request.
- Per-streamer custom extra types (new extras are code changes).
