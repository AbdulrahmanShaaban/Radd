# Plan

## Current State
**LIVE in production**: https://radd-sable.vercel.app (Vercel, project `radd`) + Neon Postgres (migrated & seeded). Full-stack demo complete and browser-verified: backend (Prisma 14 models, auth, RAG, booking, chat, evals, queue; 17/17 tests) + Next.js UI built from the approved Stitch designs (login, inbox, KB, calendar, analytics) wired to live APIs, responsive (mobile list↔thread), typecheck/lint clean. Production smoke: demo login → 6 Arabic conversations from Neon, KB 4 docs, calendar appointments, cron `/api/cron/jobs` 401 without secret / `{"ok":true}` with secret.

## In Progress
- [x] Unified verification: typecheck 0 + lint 0 + tests 17/17 (2026-10-10)
  - Note: an external process occasionally locks `tsc.exe` (`EBUSY` — same class as the historical esbuild.exe/schema-engine locks). Workaround: copy `node_modules/.pnpm/@typescript+typescript-win32-x64*/node_modules/@typescript/typescript-win32-x64/lib` to `%TEMP%` and run `tsc.exe --noEmit` from the project root.

## Next
- [ ] Push code to GitHub (repo not created yet — needs user's go-ahead; `gh` CLI not installed)

## Recently Completed
- [x] **Deploy**: Neon migrate+seed, Vercel env (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `EMBED_PROVIDER=mock`, `DAILY_SPEND_CAP_USD`, `NEXT_PUBLIC_APP_URL`), `vercel --prod`, smoke-tested end-to-end (2026-10-10)
  - `radd.vercel.app` is taken by another account → our alias is `radd-sable.vercel.app`; deployment-specific URLs sit behind Vercel Deployment Protection (login wall) — that's expected, public traffic uses the alias.
  - Build fixes: removed `force-dynamic` from `src/app/api/cron/jobs/route.ts` (illegal under `cacheComponents`); `build` script now runs `prisma generate` first.
  - Upgrade to real AI later: remove `EMBED_PROVIDER` from Vercel, add `OPENAI_API_KEY`, re-seed/ingest KB (see DECISIONS.md `deployed-embeddings`).

## Recently Completed
- [x] UI session: lucide-react icons replacing Material Symbols (2026-10-10)
- [x] Hydration fix: TimeAgo client component (2026-10-10)
- [x] Prerender fix: Suspense gates in (app) layout + pages (cacheComponents) (2026-10-10)
- [x] `checkSpendCap` always returns costUsd/capUsd (analytics crash fix) (2026-10-10)
- [x] Responsive inbox: mobile list↔thread toggle, aside xl+, viewport-locked shell (2026-10-10)
- [x] Inbox wired to `/api/conversations` (real Arabic seed data) + CLOSED state pills (2026-10-10)
- [x] End-to-end chat verified in browser: optimistic send → LLM_DISABLED note (2026-10-10)
- [x] Browser verification: 4 pages @1440 + inbox @390, console clean (2026-10-10)
- [x] TypeScript 7 side-by-side (typescript6 for eslint, typescript-7 for tsc) (2026-10-10)
- [x] docs/ scaffolding (2026-10-10)
- [x] KB upload API + jobs runner (FOR UPDATE SKIP LOCKED) (2026-10-10)
- [x] Chat API with allowlisted booking tools (2026-10-10)
- [x] Calendar API + tenant-scoped list/isSlotFree (2026-10-10)
- [x] Eval runner + daily spend cap (2026-10-10)
- [x] Cross-tenant auth/booking tests (2026-10-10)
- [x] Test harness: server-only stub + dotenv preload under tsx (2026-10-10)
- [x] Radd Stitch design fix pass (hijab rule, brand logos, footer socials, no bottom bar) (2026-10-10)
- [x] Radd foundation: Prisma, auth, RAG pipeline (2026-10-09)
