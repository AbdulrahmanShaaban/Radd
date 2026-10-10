# Decisions

## icon-library — 2026-10-10
`lucide-react` (same set shadcn/ui ships) for all UI icons; Material Symbols fully removed (CSS class + Google Fonts link).
Why: Material Symbols rendered as raw ligature text in the browser (font stylesheet unreliable), added a render-blocking third-party request, and pulled an icon font for ~15 icons. lucide-react is tree-shakeable SVG (no FOUT, offline-safe, `currentColor` inherits tokens).
Alternative considered: heroicons — fine too, but lucide's naming (`Inbox`, `Bot`, `Sparkles`) matches shadcn conventions the codebase may adopt later.

## conversation-states — 2026-10-10
Prisma `ConversationState` has three values (`AI | HUMAN | CLOSED`) and the UI renders all three: green "AI Active" pill, neutral "Staff"/"Closed" pills, header shows "Conversation Closed", aside shows `Closed` status + reopen hint. Tabs stay All / AI Active / Staff (Staff = HUMAN only; CLOSED appears under All).
Why: the seed data legitimately uses CLOSED (resolved conversations); forcing a two-state UI hid 2 of 6 demo conversations behind misleading labels.

## typescript-version — 2026-10-10
TypeScript 7.0.2 installed as `typescript-7` (npm alias of `typescript@^7.0.2`); the `typescript` package itself is aliased to `@typescript/typescript6@^6.0.0`.
Why: `typescript-eslint` (via `eslint-config-next`) does not yet support the TS 7 programmatic API and hard-fails on `require('typescript')` when it reports 7.x. The official migration path is the side-by-side alias: `tsc` (from `typescript-7`) runs the fast native TS 7 compiler for `typecheck`, while ESLint keeps using the TS 6 API. `pnpm typecheck` → `tsc --noEmit` resolves to TS 7.0.2; `pnpm lint` works.
Alternative considered: pin everything to TS 5/6 until typescript-eslint ships 7.1 support — rejected because the user explicitly requested TS 7 now and the native compiler's 10x speed is worth the alias.
Revisit when: typescript-eslint supports TS >= 7.1 (tracking typescript-eslint/typescript-eslint#10940 / #12518); then drop the alias and use a single `typescript@^7`.

## tenant-isolation — 2026-10-09
Query-layer `clinicId` filtering over Postgres RLS.
Why: Prisma's driver-adapter pool makes per-connection `SET app.clinic_id` unreliable without pinning queries to dedicated transactions — added complexity that would obscure the isolation logic in a portfolio demo. Cross-tenant safety is enforced and tested in the application layer (`tests/tenant.test.ts`).
Rejected: RLS with session vars (correct at scale, fragile under serverless pooling here).
At 100x: add RLS as defense-in-depth *and* keep the query-layer checks.

## job-queue — 2026-10-09
Background work (KB ingest, eval runs, follow-ups) on a Postgres `jobs` table claimed with `FOR UPDATE SKIP LOCKED`.
Why: Vercel Hobby runs cron once per day and holds no long-lived workers; a separate Redis would add a host to manage for a portfolio demo. The same table is re-runnable from a visible "Retry" affordance.
Rejected: Redis + BullMQ (right tool in production, wrong weight here).

## retrieval — 2026-10-09
Hybrid full-text (`to_tsvector('simple', …)`) + pgvector cosine similarity, fused with reciprocal rank fusion (k=60).
Why: pure vector search misses exact terms (prices, phone numbers, drug names) and Arabic tokenization benefits from a lexical path; exact terms shouldn't cost an embedding round-trip. The "why this answer" panel shows the retrieved chunks.
Rejected: vector-only retrieval (weaker on exact match, more LLM tokens spent re-checking).

## embeddings — 2026-10-09
`EMBED_PROVIDER=openai|mock`; auto-resolve: OpenAI when `OPENAI_API_KEY` set, mock in development otherwise, hard error in production without config.
Why: same pipeline/SQL runs locally with no API key; mock embeds by hashing words into a normalized 1536-dim vector. Avoids silently generating fake vectors inside the OpenAI path (misleading) and avoids requiring a key for every local experiment (kills contribution/test friction).

## deployed-embeddings — 2026-10-10
Production (Vercel) runs with `EMBED_PROVIDER=mock` and no `OPENAI_API_KEY` — the demo is fully functional at $0; chat answers honestly refuse (`LLM_DISABLED` note) instead of fabricating.
Why: a paid key in a portfolio demo risks runaway spend and the eval spend cap only covers eval calls, not chat; the deterministic mock keeps retrieval (KB search, "why this answer" panel) demonstrable without secrets.
Upgrade path (when real AI is wanted): delete `EMBED_PROVIDER` from Vercel env, add `OPENAI_API_KEY`, re-ingest the KB so chunks get real OpenAI embeddings (old mock vectors won't match new query embeds), redeploy. Recorded in PLAN.md deploy notes too.
