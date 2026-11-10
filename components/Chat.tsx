"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  Download,
  Folder,
  FileText,
  HardDrive,
  Lock,
  Monitor,
  Paperclip,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api, sizeFmt } from "@/lib/client";
import Modal from "@/components/Modal";
import { useNotifications } from "@/components/NotificationsContext";

/* ==========================================================================
   2. TYPES AND CONSTANTS
   ========================================================================== */
type GoogleSpace = { name: string; displayName: string; type: string };
type Attachment = { item: string; name: string; mime: string; size: number; source?: "upload" | "drive" };
type ChatMessage = {
  _id?: string; name?: string; from?: string; sender?: string; text: string;
  createdAt?: string; createTime?: string; attachments?: Attachment[];
};
type Pending = {
  id: string; name: string; size: number; pct: number;
  source: "upload" | "drive"; itemId?: string; err?: string;
};
type Group = {
  _id: string; name: string; createdBy: string; canManage: boolean;
  members: { _id: string; name: string }[];
};

const CHUNK = 8 * 1024 * 1024;
const MAX_FILES = 10;

/* ==========================================================================
   3. MAIN COMPONENT
   ========================================================================== */
export default function Chat({ me, initialChannel = "general" }: { me: string; initialChannel?: string }) {
  const { unreadByKey, setActiveChannel, reload: reloadNotifications } = useNotifications();

  const [mode, setMode] = useState<"workspace" | "google">("workspace");
  const [dir, setDir] = useState<any[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [ch, setCh] = useState(initialChannel);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [spaces, setSpaces] = useState<GoogleSpace[]>([]);
  const [space, setSpace] = useState("");
  const [t, setT] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [allowUpload, setAllowUpload] = useState(true);
  const [groupForm, setGroupForm] = useState<null | "new">(null);
  const [manage, setManage] = useState<Group | null>(null);
  const [picker, setPicker] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const pollNow = useRef<() => void>(() => {});

  const group = ch.startsWith("group:") ? groups.find((g) => `group:${g._id}` === ch) : undefined;
  const dm = (id: string) => `dm:${[me, id].sort().join(":")}`;

  /* ---------- a notification link can switch the open chat ---------- */
  useEffect(() => { setCh(initialChannel); }, [initialChannel]);

  /* ---------- tell the notification system which chat is on screen ---------- */
  useEffect(() => {
    setActiveChannel(mode === "workspace" ? ch : "");
    return () => setActiveChannel("");
  }, [ch, mode, setActiveChannel]);

  /* ---------- directory, groups, upload setting ---------- */
  const loadGroups = useCallback(() => api("/api/chat/groups").then(setGroups).catch(() => {}), []);

  useEffect(() => {
    api("/api/directory").then(setDir).catch(() => {});
    api("/api/chat/attachments").then((r) => setAllowUpload(r.allowUpload !== false)).catch(() => {});
    loadGroups();
  }, [loadGroups]);

  // Opening a chat marks its notifications as read.
  useEffect(() => {
    if (mode !== "workspace" || !unreadByKey[`chat:${ch}`]) return;
    api("/api/notifications", { method: "PATCH", body: { key: `chat:${ch}` } })
      .then(reloadNotifications)
      .catch(() => {});
  }, [ch, mode, unreadByKey, reloadNotifications]);

  /* ---------- workspace messages (poll) ---------- */
  useEffect(() => {
    if (mode !== "workspace") return;
    let live = true, last = "", busy = false;
    setMsgs([]); setPending([]);
    const poll = async () => {
      if (!live || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const rows = await api(`/api/chat?channel=${encodeURIComponent(ch)}${last ? `&after=${encodeURIComponent(last)}` : ""}`);
        if (live && rows.length) {
          last = rows[rows.length - 1].createdAt;
          setMsgs((old) => {
            const seen = new Set(old.map((m) => m._id));
            return [...old, ...rows.filter((m: ChatMessage) => !seen.has(m._id))].slice(-300);
          });
        }
        if (live) setError("");
      } catch (e: any) { if (live) setError(e.message || "Workspace chat unavailable."); }
      finally { busy = false; }
    };
    pollNow.current = poll;
    poll();
    const timer = window.setInterval(poll, 4000);
    return () => { live = false; window.clearInterval(timer); };
  }, [ch, mode]);

  /* ---------- Google Chat (unchanged behaviour) ---------- */
  useEffect(() => {
    if (mode !== "google") return;
    let live = true;
    setMsgs([]);
    (async () => {
      try {
        const rows = await api("/api/google-chat/spaces");
        if (!live) return;
        setSpaces(rows);
        setSpace((current) => current || rows[0]?.name || "");
        if (!rows.length) setError("No Google Chat spaces are available to this connected account.");
      } catch (e: any) { if (live) setError(e.message || "Unable to load Google Chat spaces. Reconnect Google with Chat permissions."); }
    })();
    return () => { live = false; };
  }, [mode]);

  useEffect(() => {
    if (mode !== "google" || !space) return;
    let live = true, busy = false;
    setMsgs([]);
    const poll = async () => {
      if (!live || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const rows = await api(`/api/google-chat/messages?space=${encodeURIComponent(space)}`);
        if (live) setMsgs(rows);
      } catch (e: any) { if (live) setError(e.message || "Unable to load Google Chat messages."); }
      finally { busy = false; }
    };
    poll();
    const timer = window.setInterval(poll, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [mode, space]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  /* ---------- attachments ---------- */
  const updatePending = (id: string, changes: Partial<Pending>) =>
    setPending((old) => old.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  // Computer upload: stored as a PROTECTED chat file, uploaded in chunks.
  const uploadOne = async (file: File, localId: string, channel: string) => {
    try {
      const item = await api("/api/chat/attachments", {
        method: "POST",
        body: { channel, name: file.name, size: file.size, mime: file.type || "application/octet-stream" },
      });
      updatePending(localId, { itemId: item._id });

      let offset = 0;
      while (offset < file.size) {
        let ok = false;
        for (let attempt = 0; attempt < 4 && !ok; attempt++) {
          try {
            const r = await fetch(`/api/files/${item._id}`, {
              method: "PUT",
              headers: { "Upload-Offset": String(offset) },
              body: file.slice(offset, offset + CHUNK),
            });
            if (r.ok) { offset = (await r.json()).offset; ok = true; }
            else {
              const head = await fetch(`/api/files/${item._id}`, { method: "HEAD" });
              const actual = Number(head.headers.get("upload-offset") || 0);
              if (head.ok && actual > offset) { offset = actual; ok = true; }
              else throw new Error("Upload failed.");
            }
          } catch (e) {
            if (attempt === 3) throw e;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
        updatePending(localId, { pct: Math.min(100, Math.round((offset / file.size) * 100)) });
      }
      updatePending(localId, { pct: 100 });
    } catch (e: any) {
      updatePending(localId, { err: e.message || "Upload failed." });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length || mode !== "workspace") return;
    if (!allowUpload) return setError("Uploading from the computer is turned off. Attach a file from Drive instead.");
    if (pending.length + list.length > MAX_FILES) return setError(`You can attach up to ${MAX_FILES} files per message.`);
    setError("");
    list.forEach((file) => {
      const id = crypto.randomUUID();
      setPending((old) => [...old, { id, name: file.name, size: file.size, pct: 0, source: "upload" }]);
      uploadOne(file, id, ch);
    });
  };

  // Drive files chosen in the picker are attached by reference (nothing is copied).
  const addDriveFiles = (files: { _id: string; name: string; size: number }[]) => {
    setPicker(false);
    const fresh = files.filter((f) => !pending.some((p) => p.itemId === f._id));
    if (pending.length + fresh.length > MAX_FILES) return setError(`You can attach up to ${MAX_FILES} files per message.`);
    setPending((old) => [
      ...old,
      ...fresh.map((f) => ({ id: crypto.randomUUID(), name: f.name, size: f.size, pct: 100, source: "drive" as const, itemId: f._id })),
    ]);
  };

  const uploading = pending.some((p) => !p.err && p.pct < 100);
  const ready = pending.filter((p) => p.itemId && p.pct === 100 && !p.err);

  /* ---------- send / unsend ---------- */
  const send = async () => {
    if (sending || uploading || (!t.trim() && !ready.length)) return;
    const text = t.trim(); setSending(true); setError("");
    try {
      if (mode === "google") {
        const sent = await api("/api/google-chat/messages", { method: "POST", body: { space, text } });
        setMsgs(old => [...old, sent]);
      } else {
        await api("/api/chat", {
          method: "POST",
          body: { channel: ch, text, attachments: ready.map((p) => ({ id: p.itemId, source: p.source })) },
        });
        setPending(old => old.filter((p) => !ready.includes(p)));
        pollNow.current();
      }
      setT("");
    } catch (e: any) { setError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  const unsend = async (message: ChatMessage) => {
    if (!message._id || !confirm("Delete this message? Files you sent from your computer are erased too.")) return;
    try {
      await api(`/api/chat?id=${message._id}`, { method: "DELETE" });
      setMsgs((old) => old.filter((m) => m._id !== message._id));
    } catch (e: any) { setError(e.message || "Message could not be deleted."); }
  };

  /* ---------- UI ---------- */
  const badge = (key: string) => unreadByKey[key] ? <span className="badge ml-2">{unreadByKey[key]}</span> : null;

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><h1 className="mr-auto text-2xl font-extrabold">Chat</h1>
      <button className={mode === "workspace" ? "btn" : "btn2"} onClick={() => { setError(""); setMode("workspace"); }}>Workspace Chat</button>
      <button className={mode === "google" ? "btn" : "btn2"} onClick={() => { setError(""); setMode("google"); }}>Google Chat</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

    {mode === "workspace" ? <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <div className="card max-h-60 overflow-auto md:max-h-[70vh]">
        <button onClick={() => setCh("general")} className={`block w-full px-4 py-3 text-left font-semibold ${ch === "general" ? "bg-purple-50 text-purple-700" : ""}`}># General</button>

        {/* Groups */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">
          Groups
          <button onClick={() => setGroupForm("new")} className="rounded-md p-1 text-purple-700 hover:bg-purple-50" title="New group" aria-label="New group"><Plus size={15} /></button>
        </div>
        {groups.map((g) => <button key={g._id} onClick={() => setCh(`group:${g._id}`)} className={`flex w-full items-center border-t border-line px-4 py-3 text-left ${ch === `group:${g._id}` ? "bg-purple-50" : ""}`}>
          <Users size={16} className="mr-2 shrink-0 text-purple-600" />
          <span className="min-w-0 flex-1"><b className="block truncate">{g.name}</b><small className="text-muted">{g.members.length} members</small></span>
          {badge(`chat:group:${g._id}`)}
        </button>)}
        {!groups.length && <p className="border-t border-line px-4 py-3 text-xs text-muted">No groups yet. Tap + to create one.</p>}

        {/* People */}
        <div className="border-t border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">People</div>
        {dir.filter(u => u._id !== me).map(u => <button key={u._id} onClick={() => setCh(dm(u._id))} className={`flex w-full items-center border-t border-line px-4 py-3 text-left ${ch === dm(u._id) ? "bg-purple-50" : ""}`}>
          <span className="min-w-0 flex-1"><b className="block truncate">{u.name}</b><small className="text-muted">{u.email}</small></span>
          {badge(`chat:${dm(u._id)}`)}
        </button>)}
      </div>

      <ChatPanel
        title={ch === "general" ? "# General" : group ? group.name : undefined}
        subtitle={group ? group.members.map((m) => m.name).join(", ") : undefined}
        onManage={group ? () => setManage(group) : undefined}
        msgs={msgs} end={end} t={t} setT={setT} send={send} sending={sending || uploading}
        placeholder={group ? `Message ${group.name}` : "Message workspace"} me={me}
        onUnsend={unsend}
        attach={{ pending, allowUpload, addFiles, openPicker: () => setPicker(true), remove: (id) => setPending((old) => old.filter((p) => p.id !== id)) }}
      />
    </div> : <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <div className="card max-h-60 overflow-auto md:max-h-[70vh] p-2">
        <div className="px-2 py-2 text-sm font-bold">Google Chat spaces</div>
        {spaces.map(s => <button key={s.name} onClick={() => setSpace(s.name)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${space === s.name ? "bg-purple-50 text-purple-700" : ""}`}>{s.displayName}</button>)}
        {!spaces.length && <p className="p-3 text-xs text-muted">Connect Google and grant Google Chat permissions to list spaces.</p>}
      </div>
      <ChatPanel msgs={msgs} end={end} t={t} setT={setT} send={send} sending={sending} placeholder="Message Google Chat" me={me} />
    </div>}

    {picker && <DrivePicker onClose={() => setPicker(false)} onPick={addDriveFiles} />}
    {groupForm && <NewGroupModal people={dir.filter((u) => u._id !== me)} onClose={() => setGroupForm(null)}
      onCreated={async (id) => { setGroupForm(null); await loadGroups(); setCh(`group:${id}`); }} />}
    {manage && <ManageGroupModal group={groups.find((g) => g._id === manage._id) || manage} people={dir} me={me}
      onClose={() => setManage(null)}
      onChanged={loadGroups}
      onGone={async () => { setManage(null); await loadGroups(); setCh("general"); }} />}
  </div>;
}

/* ==========================================================================
   4. MESSAGE PANEL
   ========================================================================== */
function ChatPanel({ title, subtitle, onManage, msgs, end, t, setT, send, sending, placeholder, me, attach, onUnsend }: {
  title?: string; subtitle?: string; onManage?: () => void;
  msgs: ChatMessage[]; end: RefObject<HTMLDivElement>;
  t: string; setT: (value: string) => void; send: () => void;
  sending: boolean; placeholder: string; me: string;
  onUnsend?: (m: ChatMessage) => void;
  attach?: {
    pending: Pending[]; allowUpload: boolean;
    addFiles: (f: FileList | File[]) => void; openPicker: () => void; remove: (id: string) => void;
  };
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [menu, setMenu] = useState(false);

  const canSend = !!t.trim() || !!attach?.pending.some((p) => p.pct === 100 && !p.err);

  return <div
    className={`card flex h-[70vh] flex-col ${drag ? "ring-2 ring-purple-400" : ""}`}
    onDragOver={(e) => { if (attach?.allowUpload) { e.preventDefault(); setDrag(true); } }}
    onDragLeave={() => setDrag(false)}
    onDrop={(e) => { if (attach?.allowUpload) { e.preventDefault(); setDrag(false); attach.addFiles(e.dataTransfer.files); } }}
  >
    {title && <div className="flex items-center gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0 flex-1"><b className="block truncate">{title}</b>{subtitle && <small className="block truncate text-muted">{subtitle}</small>}</div>
      {onManage && <button className="btn2 !px-3 !py-1.5" onClick={onManage}>Manage</button>}
    </div>}

    <div className="flex-1 space-y-2 overflow-auto p-4">
      {msgs.map((m, i) => {
        const mine = !!m.from && String(m.from) === me;
        return <div key={m._id || m.name || `${m.createTime}-${i}`} className={`group flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-slate-100 text-slate-900"}`}>
            {!mine && (m.name || m.sender) && <b className="block text-xs text-purple-700">{m.sender || m.name || "Workspace member"}</b>}
            {m.text && <span className="whitespace-pre-wrap break-words">{m.text}</span>}
            {!!m.attachments?.length && <div className="mt-1.5 space-y-1.5">
              {m.attachments.map((a) => <AttachmentView key={a.item} a={a} />)}
            </div>}
            <small className={`block text-right text-[10px] ${mine ? "text-purple-100" : "text-slate-500"}`}>{new Date(m.createdAt || m.createTime || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
          </div>
          {mine && onUnsend && m._id && <button onClick={() => onUnsend(m)} className="mb-1 hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 group-hover:block" title="Delete message" aria-label="Delete message"><Trash2 size={14} /></button>}
        </div>;
      })}<div ref={end} />
    </div>

    {/* Files waiting to be sent */}
    {!!attach?.pending.length && <div className="flex flex-wrap gap-2 border-t border-line px-3 pt-3">
      {attach.pending.map((p) => <div key={p.id} className={`flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${p.err ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-slate-50"}`}>
        {p.source === "drive" ? <HardDrive size={14} className="shrink-0 text-purple-600" /> : <Lock size={14} className="shrink-0 text-orange-600" />}
        <span className="max-w-[160px] truncate">{p.name}</span>
        <span className="text-muted">{p.err ? p.err : p.pct < 100 ? `${p.pct}%` : sizeFmt(p.size)}</span>
        <button onClick={() => attach.remove(p.id)} aria-label="Remove attachment"><X size={13} /></button>
      </div>)}
    </div>}

    <div className="flex gap-2 p-3">
      {attach && <div className="relative">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { if (e.target.files) attach.addFiles(e.target.files); e.target.value = ""; }} />
        <button className="btn2 !px-3" onClick={() => setMenu(!menu)} title="Attach files" aria-label="Attach files"><Paperclip size={18} /></button>
        {menu && <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close attach menu" onClick={() => setMenu(false)} />
          <div className="absolute bottom-12 left-0 z-40 w-64 rounded-xl border border-line bg-white p-1.5 shadow-lg">
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); attach.openPicker(); }}>
              <HardDrive size={17} className="text-purple-600" />
              <span><b className="block">From Drive</b><small className="text-muted">Attach a file you already have</small></span>
            </button>
            {attach.allowUpload && <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); fileInput.current?.click(); }}>
              <Monitor size={17} className="text-orange-600" />
              <span><b className="block">Upload from computer</b><small className="text-muted">Protected - only this chat can open it</small></span>
            </button>}
          </div>
        </>}
      </div>}
      <input className="inp min-w-0 flex-1" value={t} placeholder={placeholder} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
      <button className="btn" onClick={send} disabled={sending || !canSend}>{sending ? "Sending…" : "Send"}</button>
    </div>
  </div>;
}

/* ==========================================================================
   5. ONE ATTACHMENT INSIDE A MESSAGE
   ========================================================================== */
function AttachmentView({ a }: { a: Attachment }) {
  const url = `/api/chat/attachments/${a.item}`;
  const image = /^image\//.test(a.mime) && !/svg/i.test(a.mime);

  return <div>
    {image && <a href={url} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={a.name} loading="lazy" className="max-h-60 rounded-lg" />
    </a>}
    <a href={`${url}?dl=1`} className="mt-1 flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-800 hover:bg-purple-50">
      {a.source === "drive" ? <HardDrive size={14} className="shrink-0 text-purple-600" /> : <Lock size={14} className="shrink-0 text-orange-600" />}
      <span className="min-w-0 flex-1 truncate font-semibold">{a.name}</span>
      <span className="text-slate-500">{sizeFmt(a.size)}</span>
      <Download size={13} className="shrink-0 text-purple-600" />
    </a>
  </div>;
}

/* ==========================================================================
   6. DRIVE PICKER  (attach files that already exist in Drive)
   ========================================================================== */
function DrivePicker({ onClose, onPick }: {
  onClose: () => void;
  onPick: (files: { _id: string; name: string; size: number }[]) => void;
}) {
  const [view, setView] = useState<"mine" | "shared">("mine");
  const [path, setPath] = useState<{ _id: string; name: string }[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [picked, setPicked] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const parent = path.at(-1)?._id || "";

  useEffect(() => {
    let live = true;
    setLoading(true);
    api(`/api/files?view=${view}&parent=${parent}`)
      .then((r) => { if (live) { setItems(r.items || []); setErr(""); } })
      .catch((e) => { if (live) setErr(e.message || "Unable to load Drive."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [view, parent]);

  // Google Docs / Sheets cannot be protected, so only normal files are offered.
  const attachable = (i: any) =>
    i.type === "file" && !i.googleFileId && i.storageProvider !== "google" && i.uploaded >= i.size && i.size > 0;

  const toggle = (item: any) =>
    setPicked((old) => {
      const next = { ...old };
      if (next[item._id]) delete next[item._id]; else next[item._id] = item;
      return next;
    });

  const count = Object.keys(picked).length;

  return <Modal title="Attach from Drive" onClose={onClose} wide>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={view === "mine" ? "btn" : "btn2"} onClick={() => { setView("mine"); setPath([]); }}>My Drive</button>
        <button className={view === "shared" ? "btn" : "btn2"} onClick={() => { setView("shared"); setPath([]); }}>Shared with me</button>
      </div>

      <div className="flex flex-wrap items-center gap-1 text-sm">
        <button className="font-semibold text-purple-700" onClick={() => setPath([])}>{view === "mine" ? "My Drive" : "Shared with me"}</button>
        {path.map((p, i) => <span key={p._id} className="flex items-center gap-1">
          <span className="text-slate-400">/</span>
          <button className="font-semibold text-slate-600 hover:text-purple-700" onClick={() => setPath(path.slice(0, i + 1))}>{p.name}</button>
        </span>)}
      </div>

      <div className="max-h-[50vh] overflow-auto rounded-lg border border-line">
        {loading && <p className="p-6 text-center text-sm text-muted">Loading…</p>}
        {!loading && err && <p className="p-6 text-center text-sm text-red-600">{err}</p>}
        {!loading && !err && !items.length && <p className="p-6 text-center text-sm text-muted">Nothing here.</p>}
        {!loading && items.map((item) => item.type === "folder"
          ? <button key={item._id} onClick={() => setPath([...path, { _id: item._id, name: item.name }])} className="flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left text-sm last:border-0 hover:bg-slate-50">
              <Folder size={18} className="text-orange-500" /><span className="flex-1 truncate font-semibold">{item.name}</span>
            </button>
          : <label key={item._id} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 text-sm last:border-0 ${attachable(item) ? "cursor-pointer hover:bg-purple-50" : "opacity-50"}`}>
              <input type="checkbox" disabled={!attachable(item)} checked={!!picked[item._id]} onChange={() => toggle(item)} />
              <FileText size={18} className="text-purple-600" />
              <span className="flex-1 truncate">{item.name}</span>
              <span className="text-xs text-muted">{item.googleFileId ? "Google file" : sizeFmt(item.size)}</span>
            </label>)}
      </div>

      <p className="text-xs text-muted">The file stays in Drive. Everyone in this chat can open it from the message; your Drive sharing settings do not change.</p>
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <button className="btn2" onClick={onClose}>Cancel</button>
      <button className="btn" disabled={!count} onClick={() => onPick(Object.values(picked))}>{count ? `Attach ${count} file${count > 1 ? "s" : ""}` : "Attach"}</button>
    </div>
  </Modal>;
}

/* ==========================================================================
   7. NEW GROUP
   ========================================================================== */
function NewGroupModal({ people, onClose, onCreated }: {
  people: any[]; onClose: () => void; onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const g = await api("/api/chat/groups", { method: "POST", body: { name, members: picked } });
      onCreated(g._id);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return <Modal title="New group" onClose={onClose}>
    <div className="space-y-2.5">
      <input className="inp w-full" placeholder="Group name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="max-h-56 overflow-auto rounded-lg border border-line">
        {people.map((p) => <label key={p._id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-purple-50">
          <input type="checkbox" checked={picked.includes(p._id)} onChange={() => setPicked((c) => c.includes(p._id) ? c.filter((x) => x !== p._id) : [...c, p._id])} />{p.name}<small className="text-muted">{p.email}</small></label>)}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
    <div className="mt-4 flex justify-end"><button className="btn" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create group"}</button></div>
  </Modal>;
}

/* ==========================================================================
   8. MANAGE GROUP (rename, add / remove people, leave, delete)
   ========================================================================== */
function ManageGroupModal({ group, people, me, onClose, onChanged, onGone }: {
  group: Group; people: any[]; me: string;
  onClose: () => void; onChanged: () => void; onGone: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [err, setErr] = useState("");
  const memberIds = new Set(group.members.map((m) => m._id));
  const candidates = people.filter((p) => !memberIds.has(p._id));

  const patch = async (body: any) => {
    setErr("");
    try { await api("/api/chat/groups", { method: "PATCH", body: { id: group._id, ...body } }); await onChanged(); }
    catch (e: any) { setErr(e.message); }
  };

  const leave = async () => {
    if (!confirm("Leave this group?")) return;
    try { await api("/api/chat/groups", { method: "PATCH", body: { id: group._id, remove: [me] } }); onGone(); }
    catch (e: any) { setErr(e.message); }
  };

  const remove = async () => {
    if (!confirm("Delete this group and all its messages?")) return;
    try { await api(`/api/chat/groups?id=${group._id}`, { method: "DELETE" }); onGone(); }
    catch (e: any) { setErr(e.message); }
  };

  return <Modal title="Group settings" onClose={onClose}>
    <div className="space-y-3">
      {group.canManage && <div className="flex gap-2">
        <input className="inp min-w-0 flex-1" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        <button className="btn2" onClick={() => patch({ name })}>Rename</button>
      </div>}

      <div>
        <p className="mb-1 text-sm font-semibold">Members ({group.members.length})</p>
        <div className="max-h-40 overflow-auto rounded-lg border border-line">
          {group.members.map((m) => <div key={m._id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <span className="flex-1">{m.name}{m._id === group.createdBy && <small className="ml-2 text-muted">creator</small>}</span>
            {group.canManage && m._id !== me && <button className="text-xs text-red-600" onClick={() => patch({ remove: [m._id] })}>Remove</button>}
          </div>)}
        </div>
      </div>

      {group.canManage && !!candidates.length && <div>
        <p className="mb-1 text-sm font-semibold">Add people</p>
        <div className="max-h-40 overflow-auto rounded-lg border border-line">
          {candidates.map((p) => <div key={p._id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
            <span className="flex-1">{p.name}</span>
            <button className="text-xs font-semibold text-purple-700" onClick={() => patch({ add: [p._id] })}>Add</button>
          </div>)}
        </div>
      </div>}

      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
    <div className="mt-4 flex justify-between gap-2">
      <button className="btn2 text-red-600" onClick={leave}>Leave group</button>
      {group.canManage && <button className="btn2 text-red-600" onClick={remove}>Delete group</button>}
    </div>
  </Modal>;
}
