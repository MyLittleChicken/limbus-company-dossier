# Live asset serving implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify these tasks. This is the ops-owned boundary of the user-approved identity/E.G.O update pipeline.

**Goal:** A running production web process must discover new identity/E.G.O images and changed image bytes without restart.

**Architecture:** Preserve the current category/source/file layout. Refresh cached filename indexes when category/source directories change; version returned URLs using file metadata. Serve `/media/<category>/<source>/<file>` through a dynamic route that reads the current file and supports conditional requests. Existing `/assets` links remain available.

**Tech Stack:** Existing Next.js 16 / TypeScript / Node filesystem / node:test.

**Spec:** User requirement, 2026-09-08: manual/scheduled identity and E.G.O extraction, transformation and live additive loading including images. No live schema rename or service restart.

## Global constraints

- Data engineer owns ingestion and atomic publication to `data/assets/<category>/<source>/<file>`.
- Ops owns `lib/assets.ts`, new asset response helper/tests, and `app/media/[...path]/route.ts`.
- Do not remove existing assets or change page design; preserve source priority and filename escaping.
- Missing files, traversal and symlinks outside the asset root must not disclose files.

### Task 1: Runtime discovery and URL revision

- [x] Add `lib/assets.test.ts` with real temporary files; import the real resolver once under a temporary cwd.
- [x] Demonstrate failure when an image is added after a missing lookup, when a higher-priority source arrives, and when image bytes change.
- [x] Modify cached indexes in `lib/assets.ts` to observe directory changes, and return `/media/...?...` URLs whose revision changes after file replacement.
- [x] Run `node --import tsx --test lib/assets.test.ts` and confirm the new tests pass.

### Task 2: Live image responses

- [x] Add `lib/asset-response.test.ts`: new file after first 404, correct image bytes/type, ETag revalidation, changed file response, traversal/symlink refusal, HEAD response.
- [x] Implement `assetResponse(root: string, parts: string[], request: Request): Promise<Response>` in `lib/asset-response.ts` with bounded paths and file-handle reads.
- [x] Connect GET/HEAD in `app/media/[...path]/route.ts`, `runtime='nodejs'`, `dynamic='force-dynamic'`.
- [x] Run targeted tests and typecheck.

### Task 3: Integration gate

- [x] Build a production server, request an absent test image, atomically add it, then receive bytes from the same server process. Replace it and verify a new URL/ETag and current bytes.
- [x] Run the full tests and inspect the diff. Data integration must show the real three new entities and their images after live upsert.

No commit/push or operating-system schedule registration is part of this plan.

2026-09-08 ops evidence: resolver regression first 3 failed then 3 passed; response tests 2 passed; combined 5/5. Typecheck and production build passed. Same-process HTTP test: missing404 → file200 with exact bytes → ETag304 → atomic replacement200 with changed ETag and exact new bytes; existing identity10101 page200 uses /media. Logs: `/tmp/limbus-live-assets-build.log`, `/tmp/limbus-live-assets-start.log`. Audit server3100 targets isolated15439 DB.

Final integration: 726 tests passed with the isolated database, 0 skipped; typecheck/build passed. Same production PID51734 served new identity10616 and E.G.O20310/21210 in ko/en with every rendered image200 after live CLI apply. Reapplication returned 0 upserts, 0 child deletions and 0 image changes.
