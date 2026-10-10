import "dotenv/config";

import { DEMO_CLINIC_SLUG } from "../src/lib/demo";
import { db } from "../src/lib/db";
import { retrieveChunks } from "../src/lib/rag/retrieve";

async function main() {
  const clinic = await db.clinic.findUnique({
    where: { slug: DEMO_CLINIC_SLUG },
  });
  if (!clinic) throw new Error("Demo clinic not found — run the seed first.");

  const queries = [
    "كم سعر الكشف الأولي",
    "إيه أوقات الدوام",
    "وين موقع العيادة",
    "Do you accept Visa?",
  ];

  let failures = 0;
  for (const query of queries) {
    const rows = await retrieveChunks({
      clinicId: clinic.id,
      query,
      limit: 3,
    });
    const summary = rows
      .map((row) => `${row.title} (score=${row.score.toFixed(5)})`)
      .join(" | ");
    console.log(`Q: ${query}\n   -> ${summary || "NO RESULTS"}`);
    if (rows.length === 0) failures += 1;
  }

  await db.$disconnect();
  if (failures > 0) {
    console.error(`${failures} query/queries returned no results.`);
    process.exit(1);
  }
  console.log("smoke-rag: all queries returned results.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
