"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }
      router.push("/inbox");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Demo login failed.");
        return;
      }
      router.push("/inbox");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="w-6 h-6" strokeWidth={2} />
          </div>
          <h1 className="font-display text-3xl font-bold text-on-surface">
            Radd
          </h1>
          <p className="text-sm text-on-surface-variant text-center">
            Sign in to your clinic AI inbox
          </p>
        </div>

        <form
          onSubmit={(e) => void handleLogin(e)}
          className="rounded-2xl bg-white border border-border p-6 flex flex-col gap-4 shadow-sm"
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-on-surface">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@clinic.com"
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-on-surface">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border border-border bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          {error && (
            <div className="rounded-lg bg-error-container/40 border border-error/30 px-3 py-2 text-sm text-on-error-container">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl bg-primary text-white py-2.5 font-semibold hover:bg-primary-strong disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : null}
            Sign in
          </button>

          <button
            type="button"
            onClick={() => void handleDemo()}
            disabled={demoLoading}
            className="rounded-xl border border-border bg-surface-container-low text-on-surface py-2.5 font-medium hover:bg-surface-container-high disabled:opacity-50 transition-colors"
          >
            {demoLoading ? "Signing in…" : "Continue with demo clinic"}
          </button>
        </form>

        <p className="text-xs text-on-surface-variant text-center">
          Demo account: demo@radd.app / demo1234
        </p>
      </div>
    </div>
  );
}
