"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Hand, Bot, Sparkles, Info, Send, ArrowLeft } from "lucide-react";
import { TimeAgo } from "@/components/TimeAgo";

type Msg = {
  id: string;
  author: "USER" | "AI" | "SYSTEM";
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  patientName: string;
  phone: string;
  state: "AI" | "HUMAN" | "CLOSED";
  aiEnabled: boolean;
  channel: string;
  lastMessageAt: string;
  lastPreview: string;
  messages: Msg[];
};

// Placeholder seed data matching the approved Stitch design.
const SEED: Conversation[] = [
  {
    id: "c-mariam",
    patientName: "Mariam Al-Mansoor",
    phone: "+1 (555) 392-8491",
    state: "AI",
    aiEnabled: true,
    channel: "WHATSAPP",
    lastMessageAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    lastPreview: "Need to confirm Dr. Omar Al-Rashid slot tomorrow afternoon",
    messages: [
      {
        id: "m1",
        author: "USER",
        content:
          "Hi! I'd love to schedule a session for teeth whitening tomorrow afternoon, preferably around 4:30 PM with Dr. Omar Al-Rashid if he has an opening. Also, do you guys accept Delta Dental PPO?",
        createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      },
      {
        id: "m2",
        author: "AI",
        content:
          "Hello Mariam! Happy to help. Yes, we accept Delta Dental PPO. Dr. Omar Al-Rashid is available tomorrow at 4:30 PM and 5:15 PM.",
        createdAt: new Date(Date.now() - 11 * 60_000).toISOString(),
      },
      {
        id: "m3",
        author: "USER",
        content:
          "That works perfectly! Let's lock in Thursday at 4:30 PM please. Will I receive a confirmation text and medical form?",
        createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    ],
  },
  {
    id: "c-marcus",
    patientName: "Dr. Marcus Vance",
    phone: "+1 (555) 220-1188",
    state: "HUMAN",
    aiEnabled: false,
    channel: "SMS",
    lastMessageAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    lastPreview:
      "Insurance pre-auth question regarding periodontal code D4341",
    messages: [
      {
        id: "m4",
        author: "USER",
        content:
          "Insurance pre-auth question regarding periodontal code D4341 — can your billing team confirm coverage?",
        createdAt: new Date(Date.now() - 9 * 60_000).toISOString(),
      },
    ],
  },
  {
    id: "c-yousef",
    patientName: "Yousef Farouk",
    phone: "+20 100 123 4567",
    state: "AI",
    aiEnabled: true,
    channel: "WEBSITE",
    lastMessageAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    lastPreview: "Are you open Saturdays for consultations?",
    messages: [
      {
        id: "m5",
        author: "USER",
        content: "Are you open Saturdays for consultations?",
        createdAt: new Date(Date.now() - 14 * 60_000).toISOString(),
      },
      {
        id: "m6",
        author: "AI",
        content:
          "Yes! We're open Saturdays 10:00 AM–4:00 PM for consultations. Would you like me to book a slot?",
        createdAt: new Date(Date.now() - 13 * 60_000).toISOString(),
      },
    ],
  },
  {
    id: "c-sarah",
    patientName: "Sarah Chen",
    phone: "+1 (555) 771-3344",
    state: "AI",
    aiEnabled: true,
    channel: "WHATSAPP",
    lastMessageAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    lastPreview:
      "Swelling has gone down completely after the extraction, thanks!",
    messages: [
      {
        id: "m7",
        author: "USER",
        content:
          "Swelling has gone down completely after the extraction, thanks!",
        createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
    ],
  },
];

export function InboxClient({
  clinicId,
  userName,
}: {
  clinicId: string;
  userName: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(SEED);
  const [activeId, setActiveId] = useState<string>(SEED[0]?.id ?? "");
  const [filter, setFilter] = useState<"ALL" | "AI" | "HUMAN">("ALL");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "AI") list = list.filter((c) => c.state === "AI");
    if (filter === "HUMAN") list = list.filter((c) => c.state === "HUMAN");
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.patientName.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.lastPreview.toLowerCase().includes(q),
      );
    }
    return list;
  }, [conversations, filter, query]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [active?.messages.length, activeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations");
        const data = (await res.json().catch(() => ({}))) as {
          conversations?: Conversation[];
        };
        if (!cancelled && res.ok && Array.isArray(data.conversations)) {
          setConversations(data.conversations);
          setActiveId(data.conversations[0]?.id ?? "");
        }
      } catch {
        /* keep local fallback */
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = useCallback(async () => {
    if (!draft.trim() || !active) return;
    const content = draft.trim();
    setDraft("");
    setAiNote(null);

    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      author: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) =>
      prev
        .map((c) =>
          c.id === active.id
            ? {
                ...c,
                messages: [...c.messages, optimistic],
                lastPreview: content,
                lastMessageAt: optimistic.createdAt,
              }
            : c,
        )
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        ),
    );

    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: active.id,
          message: content,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string | null;
        note?: string;
        error?: string;
      };
      if (!res.ok) {
        setAiNote(data.error ?? "Failed to send.");
        return;
      }
      if (data.reply) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === active.id
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: `ai-${Date.now()}`,
                      author: "AI",
                      content: data.reply as string,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                  lastPreview: data.reply ?? c.lastPreview,
                  lastMessageAt: new Date().toISOString(),
                }
              : c,
          ),
        );
      } else if (data.note) {
        setAiNote(data.note);
      }
    } catch {
      setAiNote("Network error. Message not delivered.");
    } finally {
      setSending(false);
    }
  }, [active, draft]);

  const takeOver = useCallback(() => {
    if (!active) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, state: "HUMAN", aiEnabled: false } : c,
      ),
    );
    setAiNote("You have taken over. AI is paused for this conversation.");
  }, [active]);

  const resumeAI = useCallback(() => {
    if (!active) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === active.id ? { ...c, state: "AI", aiEnabled: true } : c,
      ),
    );
    setAiNote("AI resumed for this conversation.");
  }, [active]);

  const counts = {
    ALL: conversations.length,
    AI: conversations.filter((c) => c.state === "AI").length,
    HUMAN: conversations.filter((c) => c.state === "HUMAN").length,
  };

  return (
    <div className="h-full w-full flex overflow-hidden bg-surface">
      {/* Left: conversation list */}
      <section
        className={`${
          threadOpen ? "hidden md:flex" : "flex"
        } w-full md:w-[360px] flex-shrink-0 flex-col bg-surface-container-low border-r border-border`}
      >
        <div className="p-4 flex flex-col gap-2 bg-surface-container-low border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-bold text-on-surface">
                Patient Queue
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-xs font-semibold">
                {counts.ALL}
              </span>
            </div>
          </div>
          <div className="relative flex items-center">
            <Search
              className="absolute left-3 w-4 h-4 text-outline pointer-events-none"
              strokeWidth={2}
            />
            <input
              id="patient-search"
              name="patient-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-white border border-border text-on-surface placeholder:text-outline text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              placeholder="Search patient, phone..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                ["ALL", "All"],
                ["AI", "AI Active"],
                ["HUMAN", "Staff"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${
                  filter === key
                    ? "bg-primary text-white shadow-xs"
                    : "bg-white border border-border text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {label} ({counts[key]})
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
          {loadingConversations && (
            <div className="p-6 text-center text-on-surface-variant text-sm">
              Loading conversations…
            </div>
          )}
          {!loadingConversations && filtered.length === 0 && (
            <div className="p-6 text-center text-on-surface-variant text-sm">
              No conversations match this filter.
            </div>
          )}
          {filtered.map((c) => {
            const isActive = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveId(c.id);
                  setThreadOpen(true);
                }}
                className={`text-left p-3 rounded-xl border transition-all relative ${
                  isActive
                    ? "bg-white border-primary/30 shadow-sm"
                    : "bg-white border-border hover:border-primary/40"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                )}
                <div className="flex items-start gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high border border-border flex items-center justify-center text-on-surface-variant font-semibold text-sm flex-shrink-0">
                    {c.patientName
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs text-on-surface-variant flex-shrink-0">
                        <TimeAgo iso={c.lastMessageAt} />
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-on-surface truncate">
                      {c.patientName}
                    </h3>
                    <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                      {c.lastPreview}
                    </p>
                    <div className="mt-2 pt-1 flex items-center justify-between">
                      {c.state === "AI" ? (
                        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          AI Active
                        </span>
                      ) : c.state === "CLOSED" ? (
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs">
                          Closed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs">
                          Staff
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Center: chat thread */}
      <main
        className={`${
          threadOpen ? "flex" : "hidden md:flex"
        } flex-1 flex-col bg-surface relative overflow-hidden`}
      >
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-on-surface-variant">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="h-16 px-4 md:px-6 flex items-center justify-between bg-white border-b border-border z-10">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setThreadOpen(false)}
                  aria-label="Back to queue"
                  className="md:hidden p-1.5 -ml-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" strokeWidth={2} />
                </button>
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container-high border border-border flex items-center justify-center text-on-surface-variant font-semibold">
                    {active.patientName
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")}
                  </div>
                  {active.state === "AI" && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-primary ring-2 ring-white" />
                  )}
                </div>
                <div className="flex flex-col">
                  <h2 className="font-display text-lg font-bold text-on-surface leading-tight">
                    {active.patientName}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                    <span>{active.phone}</span>
                    <span>•</span>
                    <span className="text-primary flex items-center gap-1 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {active.state === "AI"
                        ? "AI Copilot Active"
                        : active.state === "CLOSED"
                          ? "Conversation Closed"
                          : "Human Handling"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {active.state === "AI" ? (
                  <button
                    type="button"
                    onClick={takeOver}
                    className="px-4 py-2 rounded-xl bg-secondary text-white hover:brightness-105 active:scale-95 transition-all shadow-xs text-sm font-bold flex items-center gap-2"
                  >
                    <Hand className="w-4 h-4" strokeWidth={2} />
                    <span className="hidden sm:inline">Take Over from AI</span>
                    <span className="sm:hidden">Take Over</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeAI}
                    className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-strong active:scale-95 transition-all shadow-xs text-sm font-bold flex items-center gap-2"
                  >
                    <Bot className="w-4 h-4" strokeWidth={2} />
                    <span className="hidden sm:inline">Resume AI</span>
                    <span className="sm:hidden">AI</span>
                  </button>
                )}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-center my-1">
                <span className="px-3 py-1 rounded-full bg-surface-container border border-border text-on-surface-variant text-xs font-medium">
                  Today • Clinical Thread
                </span>
              </div>
              {active.messages.map((m) => {
                const isAI = m.author === "AI";
                const isUser = m.author === "USER";
                if (m.author === "SYSTEM") {
                  return (
                    <div key={m.id} className="mx-auto w-full max-w-xl my-1">
                      <div className="p-2 rounded-xl bg-white border border-border text-on-surface flex items-center justify-between shadow-xs">
                        <span className="text-xs text-on-surface-variant">
                          {m.content}
                        </span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-2 max-w-[80%] ${
                      isAI ? "ml-auto flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 text-xs font-semibold ${
                        isAI
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant border border-border"
                      }`}
                    >
                      {isAI ? (
                        <Sparkles className="w-4 h-4" strokeWidth={2} />
                      ) : (
                        active.patientName
                          .split(" ")
                          .slice(0, 2)
                          .map((w) => w[0])
                          .join("")
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-sm leading-relaxed border shadow-xs ${
                        isAI
                          ? "bg-surface-container-low border-primary/20 text-on-surface rounded-tr-sm"
                          : isUser
                            ? "bg-white border-border text-on-surface rounded-tl-sm"
                            : "bg-white border-border text-on-surface"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>

            {aiNote && (
              <div className="px-6 pb-2">
                <div className="p-2.5 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center gap-2 text-xs text-on-secondary-container">
                  <Info className="w-4 h-4 text-secondary flex-shrink-0" strokeWidth={2} />
                  {aiNote}
                </div>
              </div>
            )}

            <div className="p-4 bg-white border-t border-border flex items-end gap-2 z-10">
              <textarea
                id="reply"
                name="reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder="Type a reply to the patient..."
                className="flex-1 resize-none rounded-xl border border-border bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
              <button
                type="button"
                disabled={sending || !draft.trim()}
                onClick={() => void sendMessage()}
                className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-strong disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs text-sm font-semibold flex items-center gap-1.5"
              >
                {sending ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Send className="w-4 h-4" strokeWidth={2} />
                )}
                Send
              </button>
            </div>
          </>
        )}
      </main>

      {/* Right: patient context */}
      <aside className="hidden xl:flex w-[300px] flex-shrink-0 border-l border-border bg-surface-container-low flex-col overflow-y-auto">
        {active ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex flex-col items-center text-center gap-2 pt-2">
              <div className="w-16 h-16 rounded-full bg-surface-container-high border border-border flex items-center justify-center text-on-surface-variant font-display font-bold text-xl">
                {active.patientName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </div>
              <h3 className="font-display font-bold text-on-surface">
                {active.patientName}
              </h3>
              <p className="text-xs text-on-surface-variant">{active.phone}</p>
            </div>
            <div className="rounded-xl bg-white border border-border p-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Status</span>
                <span
                  className={`font-medium ${
                    active.state === "AI" ? "text-primary" : "text-secondary"
                  }`}
                >
                  {active.state === "AI"
                    ? "AI Active"
                    : active.state === "CLOSED"
                      ? "Closed"
                      : "Staff Handling"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Channel</span>
                <span className="font-medium text-on-surface">
                  {active.channel}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-on-surface-variant">Clinic</span>
                <span className="font-medium text-on-surface font-mono text-xs truncate">
                  {clinicId.slice(0, 10)}…
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-white border border-border p-3">
              <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
                AI Confidence
              </h4>
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full"
                  style={{ width: active.state === "AI" ? "86%" : "0%" }}
                />
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                {active.state === "AI"
                  ? "High confidence. Auto-responses enabled."
                  : active.state === "CLOSED"
                    ? "Conversation closed. Reopen to resume AI."
                    : "Human handling. AI paused."}
              </p>
            </div>
            <div className="rounded-xl bg-white border border-border p-3 text-xs text-on-surface-variant">
              Signed in as <span className="font-semibold">{userName}</span>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-on-surface-variant">
            Select a patient
          </div>
        )}
      </aside>
    </div>
  );
}
