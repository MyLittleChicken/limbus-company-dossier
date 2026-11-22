# Dossier Experience Implementation Plan

**Goal:** Preserve the dossier identity while making home current, navigation recoverable and related information immediate.
**Architecture:** Server-rendered canonical data; small client components for session restoration, URL controls and previews. Reviewed file snapshot for home editorial metadata. Separate reference archive for external engine.
**Tech Stack:** Existing Next/React/TypeScript/CSS/Postgres; no new runtime dependency.
**Spec:** docs/superpowers/specs/2026-11-22-experience-design.md

## Global constraints
- Preserve all pre-existing dirty work and current fonts/themes.
- No invented game data, dates, links or unavailable public information.
- Mobile 390, tablet768, laptop1024, desktop1440; reduced motion and keyboard support.
- Only artwork receives shallow depth, no moving reading surfaces.
- User explicitly requests implementation and independent critical review; proceed without additional permission gates.

## Review focus
- Future/expired content hidden and malformed date/target rejected.
- Reload/Back/locale changes restore the same list range and item position.
- Invalid detail query falls back to highest available stage.
- Preview Escape/outside close/focus/new-tab behavior.
- Header, breadcrumb and dates do not overflow at mobile width.

## Tasks
- [x] Archive engine and required data with provenance and SHA256; validate stored checksums.
- [x] Add tested home snapshot eligibility model and render active content hierarchy.
- [x] Add tested URL/session helpers, list restoration and breadcrumb/return behavior.
- [x] Add related gift/pack and keyword previews, preserving existing relations.
- [x] Apply motion and responsive styling; keep image composition intact.
- [x] Critical reviews, corrective pass, targeted interaction tests, typecheck/test/build.

## Execution record
Implementation inline; independent reviewers read-only. Existing workspace retained because this refines extensive uncommitted user-approved work. No automatic commits or history changes.


## Validation and corrective review
- Designer reviewed 390/768/1440px screenshots: aligned tablet art at top, increased mobile dates to 12px, removed redundant inner frame.
- UX reviewer: constrained preview height; moved focus into click-opened previews; kept full-detail fallback when fetching fails.
- AI-slop reviewer: removed internal MD build stamp and duplicate event subtitle; ensured conditional pages retain an H1.
- Separate original archive: nine files, all SHA256/byte counts verified.
- 30 light/dark responsive views: HTTP 200, no page errors or horizontal overflow.
- Interaction checks: 144-item list return restored exact item offset; locale switch preserved anchor; URL uptie survives reload and invalid values use maximum; mobile keyword preview and Escape focus return verified.
- Note: Playwright locator.click scrolls the sticky language control before clicking in this layout. The locale-preservation check uses a real mouse click at its visible coordinates, avoiding test-induced scrolling.
- 749 tests: 748 passed, 1 skipped. Typecheck and production build passed; final verification logs in var/design/experience-pass.
- Current-home metadata is a reviewed local snapshot, not an automated complete event feed. Source and operation notes: content/README.md.


## Site-wide motion correction (user feedback)
The earlier banner-only tilt was rejected and removed. Motion now follows shared response/disclosure/navigation timings across catalogues, filters, native skill disclosures, mobile navigation, previews and detail choices. List containers never translate or remount for animation. Illustrations wait for replacement decoding. Continuous level input does not replay text transitions. Skeleton noise remains removed.

Independent designer/UX reviews inspected actual opening/settled frames and code. Corrected transparent drawer ghosting, interrupted drawer closing jumps, repeated Escape, outside-scroll filter focus loss, and excessive detail-query fades. Screens and interaction checks: var/design/site-motion. Checked normal/reduced motion and restored 144-item list offsets across detail return and locale change. Source timers automation remains a separate identified integration gap; this change does not claim to automate it.


## Catalogue and detail corrections
- Sorting clarified by user: preserve sinner order; base Identity/E.G.O first in each sinner, then rarity descending, release ascending, localized name and ID tie-break. Unknown release dates follow known dates. Base game IDs were checked against all 12 canonical base loadouts.
- Wedge Office 10316/11017/11116 were already present; prior positions 43/157/174 and initial48 display explained discoverability. Space-insensitive catalogue search now finds 쐐기사무소.
- Canonical keyword IDs now resolve existing game asset names. Inline status rendering retains the existing canonical icon alongside its label. Catalogue heading glyphs are site UI icons, not represented as official game menu assets.
- Detail art/stage/level selection replaces the current URL rather than adding history entries. One browser Back returns to the originating list.
- Preview placement measures actual height, preserves an 8px anchor gap, retains description paragraphs and repositions on resize/scroll. Related-preview traversal keeps the connected original anchor.
- Home uses actual event title as its primary heading; artwork/target list layout and event prominence improved; tablet stack and mobile spacing refined after visual review.
- Verification: 753 tests passed, 1 skipped; typecheck/build pass. Browser checks cover base ordering, gift keyword icons, Wedge search, Back behavior, inline icons, popup bounds/gap and KO home at390/768/1440 light/dark. Logs/screens: var/design/catalogue-corrections.
