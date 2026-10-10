import { dummyVerifyPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";
import { db } from "@/lib/db";
import { hitRateLimit } from "@/lib/ratelimit";

export type LoginOutcome =
  | { ok: true }
  | { ok: false; status: 401 | 429; error: string };

export type LoginInput = {
  email: string;
  password: string;
  ip: string;
};

export async function login(input: LoginInput): Promise<LoginOutcome> {
  const email = input.email.trim().toLowerCase();

  const ipLimit = await hitRateLimit(`login:ip:${input.ip}`, 10, 60_000);
  if (!ipLimit.ok) {
    return {
      ok: false,
      status: 429,
      error: "Too many attempts. Try again in a minute.",
    };
  }

  const emailLimit = await hitRateLimit(`login:email:${email}`, 5, 300_000);
  if (!emailLimit.ok) {
    return {
      ok: false,
      status: 429,
      error: "Too many attempts. Try again in a few minutes.",
    };
  }

  const user = await db.user.findUnique({ where: { email } });
  const passwordValid = user
    ? await verifyPassword(input.password, user.passwordHash)
    : await dummyVerifyPassword(input.password);

  if (!user || !passwordValid) {
    return { ok: false, status: 401, error: "Invalid email or password." };
  }

  await createSession(user.id);
  return { ok: true };
}

export async function loginAsDemo(ip: string): Promise<LoginOutcome> {
  return login({ email: DEMO_EMAIL, password: DEMO_PASSWORD, ip });
}

export async function logout(): Promise<void> {
  await deleteSession();
}
