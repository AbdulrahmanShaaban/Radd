import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.ESBUILD_BINARY_PATH) {
  const pnpmDir = path.join(root, "node_modules", ".pnpm");
  if (existsSync(pnpmDir)) {
    const esbuildPkg = readdirSync(pnpmDir).find((d) =>
      d.startsWith("@esbuild+win32-x64@"),
    );
    if (esbuildPkg) {
      const copy = path.join(
        pnpmDir,
        esbuildPkg,
        "node_modules",
        "@esbuild",
        "win32-x64",
        "esbuild-copy.exe",
      );
      if (existsSync(copy)) process.env.ESBUILD_BINARY_PATH = copy;
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/tsx-run.mjs <file> [args...]");
  process.exit(2);
}

const result = spawnSync("pnpm", ["exec", "tsx", ...args], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
