import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";

function LayoutFallback() {
  return (
    <div className="flex h-full items-center justify-center text-on-surface-variant text-sm">
      Loading…
    </div>
  );
}

async function SessionGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        name: session.name,
        email: session.email,
        role: session.role,
      }}
    >
      {children}
    </AppShell>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LayoutFallback />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
