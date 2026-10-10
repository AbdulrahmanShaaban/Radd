# Conventions

Project-specific choices that narrow or deviate from the global skill defaults. General rules live in the linked skills; only this project's exceptions are recorded here.

- **DB columns / Prisma models:** default Prisma camelCase mapped to snake_case table/column names via `@@map` / `@map` (e.g. `clinicId` → `"clinicId"` stays camel in the `"clinics"` table because the baseline migration `0_init` created `"clinicId"` as a quoted camelCase column). Do not "normalize" to snake_case without a migration — the live schema uses quoted camelCase columns for tenant keys.
- **TypeScript:** `tsc` is TypeScript **7.0.2** (native/Go) via the `typescript-7` alias; the `typescript` package is aliased to `@typescript/typescript6` so `typescript-eslint` (through `eslint-config-next`) keeps working. Run `pnpm typecheck` (TS 7) and `pnpm lint` (ESLint via TS 6 API). See `docs/DECISIONS.md#typescript-version`.
- **Async cookies:** Next.js 16 — always `await cookies()`. Middleware is `src/proxy.ts` (`proxy()` export + `config.matcher`), not `middleware.ts`. Read `node_modules/next/dist/docs/` before writing Next-specific code.
- **Windows esbuild workaround:** `scripts/tsx-run.mjs` sets `ESBUILD_BINARY_PATH` to the `esbuild-copy.exe` under `.pnpm` because a lingering process permanently locks the real `esbuild.exe`. Always invoke TS scripts through this wrapper (`pnpm queue:work`, `pnpm db:seed`, `pnpm eval:run`), not bare `tsx`.
- **Rate limiting:** fixed-window counters in the `RateLimit` table (`src/lib/ratelimit.ts`), not Redis. Keys are namespaced strings (`login:ip:…`, `chat:<userId>`).
- **LLM tools:** allowlist-only in `src/lib/ai/chat.ts` — never add a tool without updating `ALLOWED_TOOLS` and a corresponding test. Cancel is destructive; the UI must confirm before calling.
