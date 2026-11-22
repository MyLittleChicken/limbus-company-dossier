# Client redesign implementation plan

**Goal:** Apply the approved refined catalogue design to the actual Next.js client, across every existing route.
**Architecture:** Keep canonical queries and game semantics. Shared theme tokens, shell and catalogue toolbar own the visual system. Existing detail, reference and formation components share neutral surfaces and typography.
**Tech stack:** Next.js 16, React 19, TypeScript, CSS; local licensed fonts. Native dialog for accessible mobile navigation.
**Reference:** `var/design/shadcn-refined`, approved through the user's request to apply this design to every actual client page.

## Constraints
- Preserve existing data, ETL changes, routes, game colours and interactions.
- Top navigation on desktop; left drawer on mobile. No visible browser launch.
- System light/dark theme initially, persisted manual preference.
- Explicit search/filter application, URL state, OR within axes and AND across axes.
- Grade descending, release ascending, localized name ascending within existing groups.
- Existing unfinished product features are not invented as part of visual redesign.

## Tasks
- [x] Replace shell and neutral theme tokens; self-host existing fonts; add theme control and accessible drawer.
- [x] Port catalogue hierarchy to identity, E.G.O and gift lists; preserve actual full datasets and URL navigation.
- [x] Unify server query toolbar for packs and glossary; explicit search on home.
- [x] Restyle detail sheets, gift/pack information, reference pages and existing formation/recommendation tools; distinguish links and static labels.
- [x] Build, typecheck, exercise actual routes in Korean/English and desktop/mobile light/dark; capture review screenshots.

## Review focus
- Filter state survives reload, history and language switching; typing and draft filters do not change results.
- Mobile navigation traps focus, closes via Escape and restores focus; all pages remain reachable.
- Long translated names, game icons, and seven resistances fit narrow screens.
- Navigation and detail links stay within the actual client; no prototype port links.
- Existing formation local storage and data semantics remain intact.

## Verification

- `npm run typecheck`: passed.
- `npm run build`: passed; asset/Prisma filesystem tracing warnings remain.
- `npm test`: 739 passed, 1 skipped, 0 failed.
- 60 Korean desktop/mobile light/dark views and 15 English mobile views: HTTP 200, no page errors or horizontal overflow.
- Explicit search, draft filters, URL/reload/history, locale switch, theme persistence, drawer focus, infinite scroll and detail controls: passed.
- Evidence and screenshots: `var/design/client-redesign/`.
