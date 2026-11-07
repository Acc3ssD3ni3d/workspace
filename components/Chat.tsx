"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { api } from "@/lib/client";

type GoogleSpace = { name: string; displayName: string; type: string };
type ChatMessage = { _id?: string; name?: string; from?: string; sender?: string; text: string; createdAt?: string; createTime?: string };

export default function Chat({ me }: { me: string }) {
  const [mode, setMode] = useState<"workspace" | "google">("workspace");
  const [dir, setDir] = useState<any[]>([]);
  const [ch, setCh] = useState("general");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [spaces, setSpaces] = useState<GoogleSpace[]>([]);
  const [space, setSpace] = useState("");
  const [t, setT] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { api("/api/directory").then(setDir).catch(() => {}); }, []);

  useEffect(() => {
    if (mode !== "workspace") return;
    let live = true, last = "", busy = false;
    setMsgs([]);
    const poll = async () => {
      if (!live || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const rows = await api(`/api/chat?channel=${encodeURIComponent(ch)}${last ? `&after=${encodeURIComponent(last)}` : ""}`);
        if (live && rows.length) {
          last = rows[rows.length - 1].createdAt;
          setMsgs(old => [...old, ...rows].slice(-300));
        }
      } catch (e: any) { if (live) setError(e.message || "Workspace chat unavailable."); }
      finally { busy = false; }
    };
    poll();
    const timer = window.setInterval(poll, 10000);
    return () => { live = false; window.clearInterval(timer); };
  }, [ch, mode]);

  useEffect(() => {
    if (mode !== "google") return;
    let live = true, busy = false;
    setMsgs([]);
    const loadSpaces = async () => {
      try {
        const rows = await api("/api/google-chat/spaces");
        if (!live) return;
        setSpaces(rows);
        setSpace(current => current || rows[0]?.name || "");
        if (!rows.length) setError("No Google Chat spaces are available to this connected account.");
      } catch (e: any) { if (live) setError(e.message || "Unable to load Google Chat spaces. Reconnect Google with Chat permissions."); }
    };
    loadSpaces();
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

  const dm = (id: string) => `dm:${[me, id].sort().join(":")}`;
  const send = async () => {
    if (!t.trim() || sending) return;
    const text = t.trim(); setSending(true); setError("");
    try {
      if (mode === "google") {
        const sent = await api("/api/google-chat/messages", { method: "POST", body: { space, text } });
        setMsgs(old => [...old, sent]);
      } else {
        await api("/api/chat", { method: "POST", body: { channel: ch, text } });
      }
      setT("");
    } catch (e: any) { setError(e.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><h1 className="mr-auto text-2xl font-extrabold">Chat</h1>
      <button className={mode === "workspace" ? "btn" : "btn2"} onClick={() => { setError(""); setMode("workspace"); }}>Workspace Chat</button>
      <button className={mode === "google" ? "btn" : "btn2"} onClick={() => { setError(""); setMode("google"); }}>Google Chat</button>
    </div>
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
    {mode === "workspace" ? <div className="grid gap-3 md:grid-cols-[240px_1fr]">
      <div className="card max-h-60 overflow-auto md:max-h-[70vh]">
        <button onClick={() => setCh("general")} className={`block w-full px-4 py-3 text-left font-semibold ${ch === "general" ? "bg-blue-50" : ""}`}># General</button>
        {dir.filter(u => u._id !== me).map(u => <button key={u._id} onClick={() => setCh(dm(u._id))} className={`block w-full border-t border-line px-4 py-3 text-left ${ch === dm(u._id) ? "bg-blue-50" : ""}`}><b className="block">{u.name}</b><small className="text-muted">{u.email}</small></button>)}
      </div>
      <ChatPanel msgs={msgs} end={end} t={t} setT={setT} send={send} sending={sending} placeholder="Message workspace" />
    </div> : <div className="grid gap-3 md:grid-cols-[260px_1fr]">
      <div className="card max-h-60 overflow-auto md:max-h-[70vh] p-2">
        <div className="px-2 py-2 text-sm font-bold">Google Chat spaces</div>
        {spaces.map(s => <button key={s.name} onClick={() => setSpace(s.name)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${space === s.name ? "bg-blue-50 text-blue-700" : ""}`}>{s.displayName}</button>)}
        {!spaces.length && <p className="p-3 text-xs text-muted">Connect Google and grant Google Chat permissions to list spaces.</p>}
      </div>
      <ChatPanel msgs={msgs} end={end} t={t} setT={setT} send={send} sending={sending} placeholder="Message Google Chat" />
    </div>}
  </div>;
}

function ChatPanel({ msgs, end, t, setT, send, sending, placeholder }: {
  msgs: ChatMessage[]; end: RefObject<HTMLDivElement>;
  t: string; setT: (value: string) => void; send: () => void;
  sending: boolean; placeholder: string;
}) {
  return <div className="card flex h-[70vh] flex-col">
    <div className="flex-1 space-y-1.5 overflow-auto p-4">
      {msgs.map((m, i) => <div key={m._id || m.name || `${m.createTime}-${i}`} className="max-w-[80%] rounded-2xl bg-blue-50 px-3.5 py-2">
        {(m.name || m.sender) && <b className="block text-xs">{m.sender || m.name || "Workspace member"}</b>}
        {m.text}<small className="block text-right text-[10px] opacity-70">{new Date(m.createdAt || m.createTime || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>
      </div>)}<div ref={end} />
    </div>
    <div className="flex gap-2 border-t border-line p-3">
      <input className="inp min-w-0 flex-1" value={t} placeholder={placeholder} onChange={e => setT(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
      <button className="btn" onClick={send} disabled={sending || !t.trim()}>{sending ? "Sending…" : "Send"}</button>
    </div>
  </div>;
}
