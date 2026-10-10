import "dotenv/config";

import { runAllEvals } from "../src/lib/ai/eval";

async function main() {
  console.log("[eval] running eval cases…");
  const summary = await runAllEvals();
  console.log(
    `[eval] ${summary.passed}/${summary.total} passed, avg ${summary.avgLatencyMs}ms`,
  );
  for (const r of summary.results) {
    console.log(
      `  ${r.passed ? "PASS" : "FAIL"}  ${r.question}  (${r.latencyMs}ms)`,
    );
  }
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
