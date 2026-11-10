"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { useEffect, useState } from "react";
import { Bell, BellRing, Volume2, VolumeX } from "lucide-react";
import { NOTE_ICON, useNotifications, type Note } from "./NotificationsContext";

/* ==========================================================================
   2. HELPERS
   ========================================================================== */
function ago(value: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ==========================================================================
   3. COMPONENT  (data comes from NotificationsProvider)
   ========================================================================== */
export default function NotificationBell() {
  const { items, unread, soundOn, setSoundOn, reload, open: openNote, markAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    setDesktop(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const enableDesktop = async () => {
    if (typeof Notification === "undefined") return;
    setDesktop(await Notification.requestPermission());
  };

  const click = (n: Note) => { setOpen(false); openNote(n); };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) reload(); }}
        aria-label="Notifications"
        aria-expanded={open}
        className={`relative grid h-10 w-10 place-items-center rounded-lg transition ${open ? "bg-purple-50 text-purple-700" : "text-slate-600 hover:bg-slate-100"}`}
      >
        <Bell size={20} strokeWidth={1.9} />
        {unread > 0 && <span className="badge absolute -right-0.5 -top-0.5">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-[330px] rounded-xl border border-line bg-white shadow-lg sm:w-[380px]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSoundOn(!soundOn)}
                  className="text-slate-500 hover:text-purple-700"
                  title={soundOn ? "Mute notification sounds" : "Turn on notification sounds"}
                  aria-label="Toggle notification sound"
                >
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button onClick={markAll} disabled={!unread} className="text-xs font-semibold text-purple-700 disabled:text-slate-300">Mark all read</button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              {items.length === 0 && <p className="p-8 text-center text-sm text-slate-400">You are all caught up.</p>}
              {items.map((n) => {
                const Icon = NOTE_ICON[n.type] || NOTE_ICON.system;
                const chat = n.type === "chat";
                return (
                  <button key={n._id} onClick={() => click(n)} className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? "" : "bg-purple-50/50"}`}>
                    <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${chat ? "bg-orange-50 text-orange-600" : "bg-purple-100 text-purple-700"}`}><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <b className={`truncate text-sm ${n.read ? "font-medium text-slate-700" : "text-slate-900"}`}>{n.title}</b>
                        {(n.count || 1) > 1 && <span className="badge">{n.count}</span>}
                      </span>
                      {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400">{ago(n.createdAt)}</span>
                  </button>
                );
              })}
            </div>

            {desktop === "default" && (
              <button onClick={enableDesktop} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-purple-700 hover:bg-purple-50">
                <BellRing size={14} /> Turn on desktop alerts
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
