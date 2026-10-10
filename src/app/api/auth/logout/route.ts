import { logout } from "@/lib/auth/service";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
