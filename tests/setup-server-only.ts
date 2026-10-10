// Loads .env the way Next.js does, so modules that read process.env at
// import time (e.g. src/lib/db.ts) work under bare `tsx`.
import "dotenv/config";

// Registers a no-op for the `server-only` package so Node can import
// server modules (scheduler, chat, queue) under `tsx` for unit tests.
// Next.js still enforces the real guard in the app; this only runs in tests.
import Module from "node:module";

// Node's internal loader hooks are not in the public type surface; they are
// stable across Node 20+ and only referenced here, so a narrow cast is fine.
const mod = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _load: (request: string, ...rest: unknown[]) => unknown;
};

const originalResolve = mod._resolveFilename;
mod._resolveFilename = function (request: string, ...rest: unknown[]): string {
  if (request === "server-only") {
    return "\0server-only-noop";
  }
  return originalResolve.call(this, request, ...rest);
};

// Register a fake module for the sentinel path.
const originalLoad = mod._load;
mod._load = function (request: string, ...rest: unknown[]): unknown {
  if (request === "\0server-only-noop" || request === "server-only") {
    return {};
  }
  return originalLoad.call(this, request, ...rest);
};
