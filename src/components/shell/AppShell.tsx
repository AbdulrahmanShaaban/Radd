"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Inbox, BookOpen, CalendarDays, BarChart3, LogOut, MessageSquare } from "lucide-react";

const NAV = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/kb", label: "Knowledge", icon: BookOpen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-surface">
      <header className="h-16 flex-shrink-0 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 z-20">
        <Link href="/inbox" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5" strokeWidth={2} />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-on-surface">
            Radd
          </span>
          <span className="relative flex h-2 w-2 ml-1" title="Systems Active">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary" />
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-semibold text-on-surface">
              {user.name}
            </span>
            <span className="text-xs text-on-surface-variant">{user.role}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-surface-container-high border border-border flex items-center justify-center text-on-surface-variant font-semibold text-sm">
            {user.name
              .split(" ")
              .slice(0, 2)
              .map((w) => w[0])
              .join("")}
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            title="Sign out"
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors disabled:opacity-50"
          >
            <LogOut className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center justify-around bg-white border-b border-border px-2 py-1.5 flex-shrink-0">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <item.icon className="w-5 h-5" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}
