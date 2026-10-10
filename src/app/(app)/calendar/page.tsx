import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { CalendarClient } from "./CalendarClient";

function CalendarFallback() {
  return (
    <div className="flex h-full items-center justify-center text-on-surface-variant">
      Loading calendar…
    </div>
  );
}

async function CalendarView() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <CalendarClient />;
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarFallback />}>
      <CalendarView />
    </Suspense>
  );
}
