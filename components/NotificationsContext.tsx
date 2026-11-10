"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MessageCircle, Video, Info, X } from "lucide-react";
import { api } from "@/lib/client";

/* ==========================================================================
   2. TYPES
   ========================================================================== */
export type Note = {
  _id: string;
  type: "calendar" | "meeting" | "chat" | "system";
  title: string;
  body?: string;
  link?: string;
  key?: string;
  count?: number;
  read: boolean;
  createdAt: string;
};

type Ctx = {
  items: Note[];
  unread: number;
  chatUnread: number;
  unreadByKey: Record<string, number>;
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  reload: () => Promise<void>;
  open: (note: Note) => void;
  markAll: () => Promise<void>;
  // Chat tells us which conversation is on screen so it is not announced.
  setActiveChannel: (channel: string) => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}

export const NOTE_ICON = { calendar: CalendarDays, meeting: Video, chat: MessageCircle, system: Info };

/* ==========================================================================
   3. SOUNDS  (generated in the browser, no audio files needed)
   chat     -> two quick rising notes   (a message just arrived)
   calendar -> one soft low chime       (an event or meeting was added)
   ========================================================================== */
let audio: AudioContext | null = null;

function tone(ctx: AudioContext, freq: number, start: number, length: number, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + length + 0.05);
}

function playSound(kind: Note["type"]) {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    audio = audio || new Ctor();
    if (audio.state === "suspended") audio.resume().catch(() => {});

    if (kind === "chat") {
      tone(audio, 660, 0, 0.14, 0.12);
      tone(audio, 880, 0.13, 0.2, 0.12);
    } else {
      tone(audio, 523, 0, 0.45, 0.1);
    }
  } catch {}
}

/* ==========================================================================
   4. PROVIDER  (one single polling loop for the whole app)
   ========================================================================== */
const POLL_MS = 8000;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadByKey, setUnreadByKey] = useState<Record<string, number>>({});
  const [toasts, setToasts] = useState<Note[]>([]);
  const [soundOn, setSoundState] = useState(true);

  const seen = useRef<Set<string> | null>(null);
  const active = useRef("");
  const soundRef = useRef(true);

  /* ---------- sound preference ---------- */
  useEffect(() => {
    const saved = localStorage.getItem("ew_sound");
    const on = saved !== "off";
    soundRef.current = on;
    setSoundState(on);
  }, []);

  const setSoundOn = (on: boolean) => {
    soundRef.current = on;
    setSoundState(on);
    localStorage.setItem("ew_sound", on ? "on" : "off");
    if (on) playSound("chat");
  };

  const setActiveChannel = useCallback((channel: string) => { active.current = channel; }, []);

  /* ---------- load + announce new items ---------- */
  const reload = useCallback(async () => {
    try {
      const r = await api("/api/notifications?limit=30");
      const rows: Note[] = r.items || [];
      const keyOf = (n: Note) => `${n._id}:${n.count || 1}`;

      if (seen.current) {
        const fresh = rows.filter((n) => !n.read && !seen.current!.has(keyOf(n)));

        // A chat that is open on screen is already visible: do not announce it.
        const announce = fresh.filter((n) =>
          !(n.type === "chat" && n.key === `chat:${active.current}` && document.visibilityState === "visible"),
        );

        if (announce.length) {
          if (soundRef.current) playSound(announce.some((n) => n.type === "chat") ? "chat" : announce[0].type);

          // Toast inside the app.
          setToasts((old) => [...announce.slice(0, 3), ...old].slice(0, 4));
          announce.slice(0, 3).forEach((n) =>
            window.setTimeout(() => setToasts((old) => old.filter((t) => t._id !== n._id)), 6000),
          );

          // Desktop notification when the tab is in the background.
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") {
            announce.slice(0, 3).forEach((n) => {
              try { new Notification(n.title, { body: n.body || "", tag: n.key || n._id }); } catch {}
            });
          }
        }
      }

      seen.current = new Set(rows.map(keyOf));
      setItems(rows);
      setUnread(r.unread || 0);
      setUnreadByKey(r.unreadByKey || {});
    } catch {}
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") reload(); }, POLL_MS);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [reload]);

  /* ---------- tab title shows the unread count ---------- */
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  /* ---------- actions ---------- */
  const open = useCallback((note: Note) => {
    setToasts((old) => old.filter((t) => t._id !== note._id));
    if (!note.read) {
      setItems((old) => old.map((x) => (x._id === note._id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      api("/api/notifications", { method: "PATCH", body: { ids: [note._id] } }).then(reload).catch(() => {});
    }
    if (note.link) router.push(note.link);
  }, [reload, router]);

  const markAll = useCallback(async () => {
    await api("/api/notifications", { method: "PATCH", body: { all: true } }).catch(() => {});
    setItems((old) => old.map((x) => ({ ...x, read: true })));
    setUnread(0);
    setUnreadByKey({});
  }, []);

  const chatUnread = useMemo(
    () => Object.entries(unreadByKey).filter(([key]) => key.startsWith("chat:")).reduce((sum, [, n]) => sum + n, 0),
    [unreadByKey],
  );

  const value: Ctx = { items, unread, chatUnread, unreadByKey, soundOn, setSoundOn, reload, open, markAll, setActiveChannel };

  /* ---------- UI: toasts ---------- */
  return (
    <NotificationsContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((n) => {
          const Icon = NOTE_ICON[n.type] || Info;
          const chat = n.type === "chat";
          return (
            <div key={n._id} className="ew-toast pointer-events-auto flex gap-3 rounded-xl border border-line bg-white p-3 shadow-lg">
              <button onClick={() => open(n)} className="flex min-w-0 flex-1 gap-3 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${chat ? "bg-orange-50 text-orange-600" : "bg-purple-50 text-purple-700"}`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-sm text-slate-900">{n.title}</b>
                  {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                </span>
              </button>
              <button onClick={() => setToasts((old) => old.filter((t) => t._id !== n._id))} className="self-start text-slate-400 hover:text-slate-700" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationsContext.Provider>
  );
}
