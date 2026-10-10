import { drainQueue } from "@/lib/queue/runner";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  await drainQueue(20);
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  return GET(request);
}
