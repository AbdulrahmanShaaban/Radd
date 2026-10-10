import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { InboxClient } from "./InboxClient";

function InboxFallback() {
  return (
    <div className="flex h-full items-center justify-center text-on-surface-variant">
      Loading inbox…
    </div>
  );
}

async function InboxView() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <InboxClient clinicId={session.clinicId} userName={session.name} />
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxFallback />}>
      <InboxView />
    </Suspense>
  );
}
