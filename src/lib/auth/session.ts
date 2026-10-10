import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = {
  userId: string;
  clinicId: string;
  email: string;
  name: string;
  role: "OWNER" | "ADMIN" | "RECEPTIONIST" | "DOCTOR";
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const now = new Date();

  await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.session.create({ data: { id: hashToken(token), userId, expiresAt } }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  return {
    userId: session.user.id,
    clinicId: session.user.clinicId,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      await db.session.delete({ where: { id: hashToken(token) } });
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError) ||
        err.code !== "P2025"
      ) {
        throw err;
      }
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
