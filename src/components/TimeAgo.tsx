"use client";

import { useEffect, useState } from "react";

function formatRelative(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function TimeAgo({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (now === null) return <span suppressHydrationWarning>&nbsp;</span>;

  return <span suppressHydrationWarning>{formatRelative(iso, now)}</span>;
}
