"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import Modal from "@/components/Modal";
const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function CalendarPage() {
  const [m, setM] = useState(0), [ev, setEv] = useState<any[]>([]), [f, setF] = useState<any>(null), [err, setErr] = useState("");
  const load = () => api("/api/events").then(setEv); useEffect(() => { load(); }, []);
  const now = new Date(), b = new Date(now.getFullYear(), now.getMonth() + m, 1), n = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  const add = (d: number) => { const s = new Date(b.getFullYear(), b.getMonth(), d, 10); setErr(""); setF({ title: "", desc: "", start: local(s), end: local(new Date(+s + 36e5)), meet: true }); };
  const edit = (e: any) => { setErr(""); setF({ ...e, start: local(new Date(e.start)), end: local(new Date(e.end || e.start)) }); };
  const save = async () => { try { const body = { title: f.title, desc: f.desc, meet: f.meet, start: new Date(f.start), end: new Date(f.end) }; f._id ? await api("/api/events", { method: "PATCH", body: { id: f._id, ...body } }) : await api("/api/events", { method: "POST", body }); setF(null); load(); } catch (e: any) { setErr(e.message); } };
  const del = async () => { await api(`/api/events?id=${f._id}`, { method: "DELETE" }); setF(null); load(); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><h1 className="mr-auto text-2xl font-extrabold">Calendar</h1>
        <button className="btn2" onClick={() => setM(m - 1)}>‹</button><b className="w-40 text-center">{b.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b><button className="btn2" onClick={() => setM(m + 1)}>›</button><button className="btn2" onClick={() => setM(0)}>Today</button></div>
      <p className="text-sm text-muted">Shared company calendar — every member can add and edit events.</p>
      <div className="card grid grid-cols-7 gap-px overflow-hidden bg-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="bg-white py-2 text-center text-xs font-bold text-muted">{d}</div>)}
        {Array.from({ length: b.getDay() }, (_, i) => <div key={"b" + i} className="bg-white" />)}
        {Array.from({ length: n }, (_, i) => i + 1).map((d) => { const dt = new Date(b.getFullYear(), b.getMonth(), d);
          return <div key={d} onClick={() => add(d)} className="min-h-[70px] cursor-pointer bg-white p-1 text-xs hover:bg-blue-50 sm:min-h-[96px]">
            <span className={`grid h-6 w-6 place-items-center rounded-full font-semibold ${dt.toDateString() === now.toDateString() ? "bg-brand text-white" : ""}`}>{d}</span>
            {ev.filter((e) => new Date(e.start).toDateString() === dt.toDateString()).map((e) => <button key={e._id} onClick={(x) => { x.stopPropagation(); edit(e); }} className={`mt-0.5 block w-full truncate rounded px-1 text-left text-white ${new Date(e.end).getTime() <= Date.now() ? "bg-slate-400" : "bg-brand"}`}>{new Date(e.start).getHours()}:{pad(new Date(e.start).getMinutes())} {e.title}</button>)}</div>; })}
      </div>
      {f && <Modal title={f._id ? "Edit event" : "New event"} onClose={() => setF(null)}>
        <div className="space-y-2.5"><input className="inp w-full" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="flex gap-2"><input type="datetime-local" className="inp min-w-0 flex-1" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /><input type="datetime-local" className="inp min-w-0 flex-1" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
          <textarea className="inp w-full" rows={3} placeholder="Description" value={f.desc || ""} onChange={(e) => setF({ ...f, desc: e.target.value })} />
          {!f._id && <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.meet} onChange={(e) => setF({ ...f, meet: e.target.checked })} />Add a Meet video link</label>}
          {f.googleMeetLink && (new Date(f.end).getTime() <= Date.now()
            ? <p className="text-sm text-muted">Meeting ended</p>
            : <a className="font-semibold text-brand" href={f.googleMeetLink} target="_blank" rel="noreferrer">Join Google Meet ↗</a>)}
          {f.createdBy && <p className="text-xs text-muted">Created by {f.createdBy}</p>}{err && <p className="text-sm text-red-600">{err}</p>}</div>
        <div className="mt-4 flex justify-end gap-2">{f._id && <button className="btn2 mr-auto text-red-600" onClick={del}>Delete</button>}<button className="btn" onClick={save}>Save</button></div></Modal>}
    </div>
  );
}
