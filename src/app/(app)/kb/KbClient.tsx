"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Trash2 } from "lucide-react";

type Doc = {
  id: string;
  title: string;
  status: "PROCESSING" | "READY" | "FAILED";
  error: string | null;
  chunkCount: number;
  source: string;
  createdAt: string;
};

const STATUS_STYLE: Record<Doc["status"], string> = {
  READY: "bg-primary/10 text-primary",
  PROCESSING: "bg-secondary/10 text-secondary",
  FAILED: "bg-error-container/60 text-on-error-container",
};

export function KbClient() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/kb/documents");
      const data = (await res.json().catch(() => ({}))) as {
        documents?: Doc[];
        error?: string;
      };
      if (res.ok && data.documents) {
        setDocs(data.documents);
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError("Failed to load documents.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/kb/documents");
        const data = (await res.json().catch(() => ({}))) as {
          documents?: Doc[];
          error?: string;
        };
        if (cancelled) return;
        if (res.ok && data.documents) setDocs(data.documents);
        else if (data.error) setError(data.error);
      } catch {
        if (!cancelled) setError("Failed to load documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/kb/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setTitle("");
      setText("");
      await load();
    } catch {
      setError("Network error.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/kb/documents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      setError("Failed to delete.");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-on-surface">
          Knowledge Base
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Upload clinic policies, service details, and FAQs. The AI uses these
          to answer patients.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleUpload(e)}
        className="rounded-2xl bg-white border border-border p-5 flex flex-col gap-3 shadow-sm"
      >
        <h2 className="font-display font-semibold text-on-surface">
          Add document
        </h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Document title (e.g. Insurance policies)"
          className="rounded-xl border border-border bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={6}
          placeholder="Paste document text here…"
          className="rounded-xl border border-border bg-surface-container-low px-3 py-2 text-sm text-on-surface resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {error && (
          <div className="rounded-lg bg-error-container/40 border border-error/30 px-3 py-2 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={uploading || !title.trim() || !text.trim()}
          className="self-start rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary-strong disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2"
        >
          {uploading ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Upload className="w-4 h-4" strokeWidth={2} />
          )}
          Upload &amp; index
        </button>
      </form>

      <div className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-display font-semibold text-on-surface">
            Documents
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            Loading…
          </div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            No documents yet. Upload your first document above.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li
                key={d.id}
                className="px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {d.title}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {d.chunkCount} chunks • {d.source} •{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[d.status]}`}
                  >
                    {d.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(d.id)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
