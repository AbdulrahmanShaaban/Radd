import "dotenv/config";

import { drainQueue } from "../src/lib/queue/runner";

async function main() {
  console.log("[queue] processing jobs…");
  await drainQueue(20);
  console.log("[queue] done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
