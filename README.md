# Radd — AI Inbox for Clinics

Multi-tenant AI messaging and booking platform for clinics. It answers patient questions from each clinic's own knowledge base (hybrid retrieval), books / reschedules / cancels appointments through LLM tool calls, and lets staff take over any conversation with the full history intact. Bilingual Arabic/English admin, RTL included.

**Live demo:** https://radd-sable.vercel.app · **Demo login:** one click on the login page (or `demo@radd.app` / `demo1234`, clinic "عيادة النور التخصصية").

**Status:** live + public repo + README done. Marked `DONE` in the portfolio skill only after the 60s recording + cover image are added.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 — deployed on Vercel
- PostgreSQL (Neon) with `pgvector` + full-text search — one database, no other hosts
- Prisma 7 with the `pg` driver adapter
- Zod for all input/output validation

## Quick start

```bash
pnpm install
cp .env.example .env      # set DATABASE_URL
pnpm prisma migrate deploy
pnpm prisma db seed       # demo clinic + knowledge base + conversations
pnpm dev
```

One-click demo login and "Reset demo data" ship with the app — the seeded data is what the public demo runs on.

## Architecture

```mermaid
flowchart LR
  subgraph clients
    P[Patient<br/>web chat / Messenger / Instagram]
    S[Staff<br/>inbox UI]
  end
  subgraph app["Next.js on Vercel"]
    W[Channel adapters<br/>+ simulator]
    A[Route handlers<br/>Zod · session · clinic scope]
    AI[AI layer<br/>allowlisted tools:<br/>book / reschedule / cancel]
    R[Hybrid RAG<br/>FTS + pgvector<br/>rank fusion]
    J[Jobs runner<br/>after() + daily cron<br/>FOR UPDATE SKIP LOCKED]
  end
  DB[(Neon Postgres<br/>multi-tenant data + jobs table)]
  P --> W --> A
  S --> A
  A --> AI --> R
  A --> J
  A <--> DB
  R <--> DB
  J <--> DB
```

```
src/
  app/
    (marketing)/          landing
    (app)/                inbox, KB, calendar, analytics (session required)
    api/                  route handlers (validation at every boundary)
  lib/
    db.ts                 Prisma singleton (driver adapter)
    auth/                 session + clinic scoping
    rag/                  chunk → embed → hybrid retrieve → rank fusion
    queue/                Postgres-backed job runner (SKIP LOCKED)
    ratelimit/            per-IP + per-session caps for LLM spend
  generated/prisma/       Prisma client (gitignored)
prisma/
  schema.prisma
  migrations/0_init/      baseline SQL (includes pgvector + GIN index)
```

## Decisions & trade-offs

**1. Tenant isolation in the query layer, not Postgres RLS.**
Every tenant table carries `clinic_id`, and all reads/writes go through helpers that require the session's clinic id. Cross-tenant access is proven by automated tests that attempt it and must fail.
*Why:* Prisma's connection pool makes per-connection session variables (`SET app.clinic_id`) unreliable without pinning every query to a dedicated transaction — real complexity for a demo that would obscure the actual isolation logic.
*Rejected:* Row-Level Security with session vars (correct at scale, fragile under serverless pooling here).
*At 100x:* add RLS as defense-in-depth **and** keep the query-layer checks.

**2. Background work runs on a `jobs` table, not Redis/BullMQ.**
Follow-ups, document ingestion and eval runs are rows in `jobs`, claimed with `FOR UPDATE SKIP LOCKED`, processed by a route handler triggered with `after()` plus a daily Vercel cron as a safety net, and re-runnable from a visible "Retry" button.
*Why:* Vercel Hobby runs cron once per day and serverless holds no long-lived workers; a separate Redis would add a host to manage for a portfolio demo.
*Rejected:* Redis + BullMQ (right tool in production, wrong weight here).

**3. Hybrid retrieval: full-text + pgvector with rank fusion.**
Answers are grounded by combining `to_tsvector('simple', …)` ranking with cosine similarity over embeddings, then fusing both lists (reciprocal rank fusion). The "why this answer" panel shows the retrieved chunks.
*Why:* pure vector search misses exact terms (drug names, prices, phone numbers) and Arabic tokenization benefits from a lexical path; exact terms shouldn't cost an embedding round-trip.
*Rejected:* vector-only retrieval (weaker on exact match, more LLM tokens spent re-checking).

**4. Embeddings: OpenAI in production, deterministic mock locally.**
`EMBED_PROVIDER=openai|mock` (auto: OpenAI when `OPENAI_API_KEY` is set, mock in development otherwise, hard error in production without config). The mock embeds by hashing words into a normalized 1536-dim vector — same pipeline, same SQL, no API key needed to run and test locally.
*Rejected:* silently generating fake vectors inside the OpenAI path (misleading demo behavior); requiring a key for every local experiment (kills contribution/test friction).

## What I'd change at 100x scale

- RLS as a second isolation layer (see decision 1), plus per-tenant encryption keys.
- Real queue workers (SQS/BullMQ) and a connection-pooled DB with statement timeouts.
- Streaming answers over SSE with per-tenant rate limits at the edge, not just in the app.
- Channel adapters (WhatsApp Cloud API etc.) moved behind a webhook ingestion service with signature verification and replay protection.

## Security notes

- Server-side authorization on every route; Zod validation on all inputs; secure HTTP-only session cookies.
- LLM tools are allowlisted; destructive calls (cancel appointment) require explicit confirmation.
- Prompt-injection test cases live in the repo; uploaded documents are treated as untrusted input.
- Public demo: per-IP/session rate limits, daily spend cap, short max tokens, cached answers for demo prompts.
