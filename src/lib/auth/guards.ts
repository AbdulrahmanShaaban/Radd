import { getSession, type SessionUser } from "@/lib/auth/session";

export type SessionGuard =
  | { ok: true; session: SessionUser }
  | { ok: false; response: Response };

export async function guardSession(): Promise<SessionGuard> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json(
        { error: "Authentication required." },
        { status: 401 },
      ),
    };
  }
  return { ok: true, session };
}
