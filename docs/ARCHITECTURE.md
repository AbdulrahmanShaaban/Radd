# Architecture

## Stack
Next.js 16 (App Router) + React 19 + TypeScript 7 (tsc) + Tailwind CSS 4, deployed on Vercel.
PostgreSQL (Neon or local Docker `pgvector:pg16`) with `pgvector` + full-text search.
Prisma 7 with the `@prisma/adapter-pg` driver adapter (required; no Rust engine).
Zod for every request/response boundary.
Auth: opaque server-side sessions (SHA-256 token in httpOnly cookie), scrypt password hashing.

## Structure
```
src/
  app/
    api/
      auth/{login,logout,demo}/route.ts
      kb/documents/route.ts        GET list, POST upload, DELETE by id
      chat/route.ts                POST message → AI reply (tool-aware)
      calendar/route.ts            GET appointments for a date
      evals/route.ts               POST run evals, GET spend-cap status
      cron/jobs/route.ts           GET/POST drain the job queue (CRON_SECRET)
    (marketing)/  login page
    (app)/        inbox, kb, calendar, analytics (session required via proxy.ts)
  lib/
    db.ts               Prisma singleton (driver adapter)
    demo.ts             demo clinic constants
    ratelimit.ts        fixed-window per-key counters (RateLimit table)
    auth/{cookie,session,service,password,guards}.ts
    rag/{chunk,embed,fusion,ingest,retrieve}.ts
    booking/{scheduler,calendar}.ts
    ai/{chat,eval}.ts
    queue/{jobs,runner}.ts
  generated/prisma/     Prisma client output (gitignored)
prisma/
  schema.prisma
  seed.ts
  migrations/0_init/    baseline SQL (pgvector + GIN index)
scripts/
  process-jobs.ts  run-evals.ts  tsx-run.mjs
tests/
  rag.test.ts  booking.test.ts  tenant.test.ts  chat-tools.test.ts
```

## Key Patterns In Use
- **Tenant scoping in the query layer, not RLS.** Every tenant table carries `clinicId`; every read/write is filtered by the session's `clinicId`. Cross-tenant access is proven by automated tests that must fail (see `tests/tenant.test.ts`).
- **Jobs on a Postgres `jobs` table with `FOR UPDATE SKIP LOCKED`** (`src/lib/queue/jobs.ts:claimNextJob`). Processed via `after()` kick + daily Vercel cron (`/api/cron/jobs` with `CRON_SECRET`). Exponential backoff, `DEAD` after max attempts.
- **Hybrid retrieval: FTS + pgvector, fused with reciprocal rank fusion** (`src/lib/rag/retrieve.ts`, `fusion.ts`). Clinic-scoped by `clinicId`.
- **LLM tools are allowlisted** (`src/lib/ai/chat.ts`): only `check_availability`, `book_appointment`, `cancel_appointment`. Cancel is destructive → requires confirmation upstream (UI); tool itself only cancels a matching BOOKED/RESCHEDULED row for the session's clinic.
- **Spend cap before any eval/LLM spend** (`src/lib/ai/eval.ts:checkSpendCap`) backed by `UsageDaily`.
- **Deterministic mock embeddings** when `EMBED_PROVIDER=mock` or no `OPENAI_API_KEY` in dev (`src/lib/rag/embed.ts`).
