import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AnalyticsClient } from "./AnalyticsClient";

function AnalyticsFallback() {
  return (
    <div className="flex h-full items-center justify-center text-on-surface-variant">
      Loading analytics…
    </div>
  );
}

async function AnalyticsView() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <AnalyticsClient />;
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsView />
    </Suspense>
  );
}
