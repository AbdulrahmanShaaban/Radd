import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
};

export async function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  try {
    const row = await db.rateLimit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count) };
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) throw err;
    const row = await db.rateLimit.update({
      where: { key_windowStart: { key, windowStart } },
      data: { count: { increment: 1 } },
    });
    return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count) };
  }
}
