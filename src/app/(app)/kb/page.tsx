import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { KbClient } from "./KbClient";

function KbFallback() {
  return (
    <div className="flex h-full items-center justify-center text-on-surface-variant">
      Loading knowledge base…
    </div>
  );
}

async function KbView() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <KbClient />;
}

export default function KbPage() {
  return (
    <Suspense fallback={<KbFallback />}>
      <KbView />
    </Suspense>
  );
}
