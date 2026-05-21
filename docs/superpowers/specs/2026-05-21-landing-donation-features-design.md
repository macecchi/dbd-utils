# Landing page: surface build requests + multi-request donations

**Date:** 2026-05-21
**Status:** Approved (design)

## Goal

The landing page (`apps/web/src/components/LandingPage.tsx`) is acquisition copy
for prospective streamers who have not connected yet. Two shipped, user-visible
features are absent from it:

- **Build requests** (donation extras, [ddd316b]) — a donor pays a streamer-set
  extra to dictate the loadout (perks, addons, or a theme) for the character
  they request. Rendered as a perk-diamond `BuildBadge` on the queue card's
  avatar, with the build text in a tooltip.
- **Multi-request donations** ([69d7618]) — one donation above the room's
  minimum can contain several characters ("2 de trapper e 1 de nurse"); the LLM
  splits them into individual queue entries (up to 10). Each resulting card
  shows a `donation-group-chip` (`1/2`, `2/2`, …) next to the donor name.

Both are donation enhancements, so they are presented together in one band with
a single mockup that demonstrates both markers.

Out of audience: the existing "what's new" toast digest
(`apps/web/src/hooks/useWhatsNew.tsx`) already surfaces these to **logged-in
owners**. This work targets the **logged-out** landing audience and does not
touch that mechanism.

## Approach

Add a dedicated highlight band ("Donations that do more") between the existing
"How it works" feature grid and the "Get started in 3 steps" section. The
4-card grid is left untouched (keeps its balanced 2×2). The band reuses real
product components so the mockup reads as "this is the actual thing".

## Layout

Two-column band, stacking to one column at the existing 480px breakpoint.

- **Left — copy:** a section heading plus two labelled points:
  - **Build requests** — donors pay a little extra to choose the build (perks,
    addons, or a theme) for their character; it shows as a badge on the card.
  - **Multi-request donations** — one donation above the minimum can carry
    several characters at once; the AI splits them into separate queue entries.
- **Right — mockup:** one donation rendered as two stacked mini queue cards,
  demonstrating both features in a single visual:
  - Card 1: position `01`, Trapper, donor `alex` with group chip `1/2`,
    perk-diamond build badge on the avatar, and a build line
    (e.g. "Lethal Pursuer, BBQ").
  - Card 2: position `02`, Nurse, donor `alex` with group chip `2/2`.
  - A shared `R$ 20` amount badge conveys "one donation".

## Components

- **`LandingDonationMockup`** — a new presentational sub-component, colocated in
  `LandingPage.tsx` (or a sibling file if it grows). Static markup that echoes
  the real queue card structure (position number, avatar, char name, donor +
  group chip, build line, amount badge) **without** any drag/interaction/state
  logic from `CharacterRequestCard`.
  - Reuses the existing presentational `CharacterAvatar`, passing
    `extras={[{ type: 'build', text: '…' }]}` on the first card so the authentic
    `BuildBadge` renders. Real killer portraits via `getKillerPortrait`.
  - The build text is shown as a static line in the card body (the real tooltip
    is hover-only and unsuitable for a static marketing mockup).
- **`LandingPage`** — insert the band `<section>` after the "How it works"
  section and before "Get started in 3 steps".

## Data flow

None. The mockup is fully static (hardcoded sample character names, donor,
amount, build text via i18n). No API calls, no store access, no props from
parent beyond translation via `useTranslation`.

## i18n

New keys in **both** `en.ts` and `pt-BR.ts` (pt-BR defines `TranslationKeys`, so
both must stay in sync or typecheck fails):

- `landing.donationsBandTitle` — band heading
- `landing.buildRequestsTitle` / `landing.buildRequestsDesc`
- `landing.multiRequestTitle` / `landing.multiRequestDesc`
- `landing.mockupBuildLine` — the sample build text shown on the mockup card
  (e.g. "Lethal Pursuer, BBQ")

Copy tone borrowed from existing `extras.build.*` and
`whatsNew.multiRequestDonations`. Sample character names (Trapper, Nurse) come
from the character data and are not translated.

## Styling

New rules in `apps/web/src/styles/landing.css`:

- `.landing-donations-band` — two-column grid/flex; collapses to one column at
  `max-width: 480px` (the breakpoint already used by `.landing-features`).
- Mockup card styling that visually matches the real cards but is self-contained
  (no dependency on `requests.css` interaction states). Reuse existing tokens
  (`--bg-elevated`, `--border`, `--radius-lg`, amount/source colors) for
  consistency.
- Reuse the existing `landingFadeUp` animation for entrance, consistent with the
  other sections.

## Error handling

Not applicable — static, no async, no user input. Portrait images fall back to
role-icon placeholders via `CharacterAvatar`'s existing placeholder path if a
portrait URL is missing.

## Testing

- `bun run typecheck` — confirms i18n key parity (pt-BR is the key source) and
  prop types on reused components.
- `bun run test` — existing suite must stay green (no logic added that needs new
  unit tests; the mockup is presentational).
- Visual verification in the browser preview at the landing route: band renders
  after the grid, both group chips and the build badge are visible, layout
  stacks correctly on a narrow viewport, both locales render without overflow.

## Release impact

- Pure additive UI on a static, logged-out page. No data shapes, storage, or
  API surfaces change. No migration, no client/server compatibility concern.
- New i18n keys must land in both locale files in the same commit or typecheck
  fails — that is the only coupling.

## Out of scope (YAGNI)

- No changes to the existing 4-card "How it works" grid.
- No new image assets — reuse existing portraits and `perk.webp`.
- No new animations beyond the existing `landingFadeUp`.
- No changes to the owner-facing `useWhatsNew` digest.

[ddd316b]: https://github.com/macecchi/fila-dbd/commit/ddd316b
[69d7618]: https://github.com/macecchi/fila-dbd/commit/69d7618
