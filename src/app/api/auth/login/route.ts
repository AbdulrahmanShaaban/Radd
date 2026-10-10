import { z } from "zod";
import { login } from "@/lib/auth/service";

const LoginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(200),
  })
  .strict();

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await login({ ...parsed.data, ip: clientIp(request) });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
