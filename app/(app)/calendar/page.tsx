"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { useEffect, useMemo, useState } from "react";
import { UserCog } from "lucide-react";
import { api } from "@/lib/client";
import Modal from "@/components/Modal";
import { hasHolidayData, holidaysByDate, type Holiday } from "@/lib/holidays";

/* ==========================================================================
   2. HELPERS AND TYPES
   ========================================================================== */
const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

type Tab = "personal" | "org";
type Visibility = "everyone" | "selected" | "private";
type Person = { _id: string; name: string; email: string };
type Editor = { _id: string; name: string; email: string; role: string; orgCalendarEditor: boolean };

const HOLIDAY_STYLE: Record<Holiday["type"], string> = {
  public: "border-l-2 border-orange-500 bg-orange-50 text-orange-800",
  festival: "border-l-2 border-slate-300 bg-slate-100 text-slate-600",
  observance: "border-l-2 border-slate-200 bg-white text-slate-500",
};

/* ==========================================================================
   3. PAGE
   ========================================================================== */
export default function CalendarPage() {
  const [tab, setTab] = useState<Tab>("personal");
  const [m, setM] = useState(0), [ev, setEv] = useState<any[]>([]), [f, setF] = useState<any>(null), [err, setErr] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEditOrg, setCanEditOrg] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [showHolidays, setShowHolidays] = useState(true);
  const [editorsOpen, setEditorsOpen] = useState(false);

  /* ---------- data ---------- */
  const load = () => api(`/api/events?scope=${tab}`).then(setEv).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api("/api/calendar/access").then((a) => { setCanEditOrg(Boolean(a.canEditOrg)); setIsAdmin(Boolean(a.isAdmin)); }).catch(() => {});
    api("/api/directory").then(setPeople).catch(() => {});
    setShowHolidays(localStorage.getItem("ew_cal_holidays") !== "off");
  }, []);

  const toggleHolidays = (on: boolean) => {
    setShowHolidays(on);
    localStorage.setItem("ew_cal_holidays", on ? "on" : "off");
  };

  /* ---------- permissions for the tab that is open ---------- */
  const canAdd = tab === "personal" || canEditOrg;

  /* ---------- month grid ---------- */
  const now = new Date(), b = new Date(now.getFullYear(), now.getMonth() + m, 1), n = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  const year = b.getFullYear(), month = b.getMonth();

  const holidays = useMemo(() => holidaysByDate(year), [year]);
  const monthHolidays = useMemo(
    () => Object.values(holidays).flat().filter((h) => h.date.startsWith(`${year}-${pad(month + 1)}-`)).sort((a, c) => a.date.localeCompare(c.date)),
    [holidays, year, month],
  );

  /* ---------- open the form ---------- */
  const add = (d: number) => {
    if (!canAdd) return;
    const s = new Date(year, month, d, 10);
    setErr("");
    setF({
      title: "", desc: "", start: local(s), end: local(new Date(+s + 36e5)), meet: false,
      scope: tab, visibility: tab === "personal" ? "private" : "everyone", audience: [], canEdit: true,
    });
  };
  const edit = (e: any) => {
    setErr("");
    setF({ ...e, start: local(new Date(e.start)), end: local(new Date(e.end || e.start)), audience: (e.audience || []).map(String) });
  };

  /* ---------- save / delete ---------- */
  const save = async () => {
    try {
      const body: any = {
        title: f.title, desc: f.desc, meet: f.meet, scope: f.scope,
        start: new Date(f.start), end: new Date(f.end),
      };
      if (f.scope === "org") { body.visibility = f.visibility; body.audience = f.audience; }
      f._id ? await api("/api/events", { method: "PATCH", body: { id: f._id, ...body } }) : await api("/api/events", { method: "POST", body });
      setF(null); load();
    } catch (e: any) { setErr(e.message); }
  };
  const del = async () => {
    try { await api(`/api/events?id=${f._id}`, { method: "DELETE" }); setF(null); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const toggleAudience = (id: string) =>
    setF({ ...f, audience: f.audience.includes(id) ? f.audience.filter((x: string) => x !== id) : [...f.audience, id] });

  /* ---------- colours ---------- */
  const chip = (e: any) =>
    new Date(e.end).getTime() <= Date.now() ? "bg-slate-400"
    : e.kind === "meeting" ? "bg-purple-500"
    : e.scope === "personal" ? "bg-slate-800"
    : e.visibility === "private" ? "bg-purple-900"
    : "bg-brand";

  const readOnly = f && !f.canEdit;
  const isOrgForm = f?.scope === "org" && f?.kind !== "meeting";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2"><h1 className="mr-auto text-2xl font-extrabold">Calendar</h1>
        <button className="btn2" onClick={() => setM(m - 1)}>‹</button><b className="w-40 text-center">{b.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</b><button className="btn2" onClick={() => setM(m + 1)}>›</button><button className="btn2" onClick={() => setM(0)}>Today</button></div>

      {/* Tabs + options */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={tab === "personal" ? "btn" : "btn2"} onClick={() => setTab("personal")}>My Calendar</button>
        <button className={tab === "org" ? "btn" : "btn2"} onClick={() => setTab("org")}>Organisation Calendar</button>
        <p className="ml-1 hidden text-sm text-muted lg:block">
          {tab === "personal"
            ? "Only you can see these events — not even admins."
            : canEditOrg
              ? "You can add and edit Organisation events."
              : "Organisation events — view only. Ask an admin for editor access."}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showHolidays} onChange={(e) => toggleHolidays(e.target.checked)} />
            Holidays &amp; festivals
          </label>
          {isAdmin && tab === "org" && (
            <button className="btn2" onClick={() => setEditorsOpen(true)}><UserCog size={16} /> Who can edit</button>
          )}
        </div>
      </div>

      {/* Month grid */}
      <div className="card grid grid-cols-7 gap-px overflow-hidden bg-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <div key={d} className={`bg-white py-2 text-center text-xs font-bold ${i === 0 ? "text-orange-600" : "text-muted"}`}>{d}</div>)}
        {Array.from({ length: b.getDay() }, (_, i) => <div key={"b" + i} className="bg-slate-50" />)}
        {Array.from({ length: n }, (_, i) => i + 1).map((d) => {
          const dt = new Date(year, month, d);
          const sunday = dt.getDay() === 0;
          const today = dt.toDateString() === now.toDateString();
          const dayHolidays = showHolidays ? holidays[dayKey(year, month, d)] || [] : [];
          const isPublic = dayHolidays.some((h) => h.type === "public");

          return <div key={d} onClick={() => add(d)} className={`min-h-[78px] p-1 text-xs sm:min-h-[104px] ${sunday || isPublic ? "bg-orange-50/40" : "bg-white"} ${canAdd ? "cursor-pointer hover:bg-purple-50" : ""}`}>
            <span className={`grid h-6 w-6 place-items-center rounded-full font-semibold ${today ? "bg-brand text-white" : sunday || isPublic ? "text-orange-600" : ""}`}>{d}</span>

            {dayHolidays.slice(0, 2).map((h) => (
              <div key={h.name} title={`${h.name} (${h.type === "public" ? "Public holiday" : h.type === "festival" ? "Festival" : "Observance"})`} className={`mt-0.5 truncate rounded-r px-1 py-px text-[10px] font-medium ${HOLIDAY_STYLE[h.type]}`}>{h.name}</div>
            ))}
            {dayHolidays.length > 2 && <div className="mt-0.5 px-1 text-[10px] text-slate-400" title={dayHolidays.slice(2).map((h) => h.name).join(", ")}>+{dayHolidays.length - 2} more</div>}

            {ev.filter((e) => new Date(e.start).toDateString() === dt.toDateString()).map((e) => <button key={e._id} onClick={(x) => { x.stopPropagation(); edit(e); }} className={`mt-0.5 block w-full truncate rounded px-1 text-left text-white ${chip(e)}`}>{new Date(e.start).getHours()}:{pad(new Date(e.start).getMinutes())} {e.title}</button>)}
          </div>;
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-brand" />Organisation</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-slate-800" />Personal</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-purple-500" />Meeting</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-slate-400" />Past</span>
        {showHolidays && <>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-orange-500" />Public holiday / Sunday</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded bg-slate-300" />Festival</span>
        </>}
      </div>
      {err && !f && <p className="text-sm text-red-600">{err}</p>}

      {/* Holidays of the month */}
      {showHolidays && <div className="card p-4">
        <h2 className="mb-2 text-sm font-bold">Holidays &amp; festivals in {b.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
        {monthHolidays.length === 0
          ? <p className="text-sm text-muted">None this month.</p>
          : <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {monthHolidays.map((h, i) => <li key={h.date + h.name + i} className="flex items-center gap-2">
                <span className={`w-14 shrink-0 text-xs font-semibold ${h.type === "public" ? "text-orange-600" : "text-slate-500"}`}>{new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span className="truncate">{h.name}</span>
                {h.type === "public" && <span className="rounded bg-orange-50 px-1.5 text-[10px] font-semibold text-orange-700">Holiday</span>}
              </li>)}
            </ul>}
        {!hasHolidayData(year) && <p className="mt-2 text-xs text-muted">Full holiday data is available for 2026 and 2027. Other years show the fixed national days only.</p>}
        <p className="mt-2 text-xs text-slate-400">India · Central Government (DoPT) list. Festival dates that follow the moon may shift by a day.</p>
      </div>}

      {/* Event form */}
      {f && <Modal title={readOnly ? "Event details" : f._id ? "Edit event" : f.scope === "personal" ? "New personal event" : "New organisation event"} onClose={() => setF(null)}>
        <div className="space-y-2.5"><input className="inp w-full" placeholder="Title" disabled={readOnly} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="flex gap-2"><input type="datetime-local" disabled={readOnly} className="inp min-w-0 flex-1" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /><input type="datetime-local" disabled={readOnly} className="inp min-w-0 flex-1" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
          <textarea className="inp w-full" rows={3} placeholder="Description" disabled={readOnly} value={f.desc || ""} onChange={(e) => setF({ ...f, desc: e.target.value })} />

          {/* Who can see an Organisation event */}
          {isOrgForm && !readOnly && <div className="space-y-2 rounded-lg border border-line p-3">
            <label className="block text-sm font-semibold">Who can see this event?</label>
            <select className="inp w-full" value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value as Visibility })}>
              <option value="everyone">Everyone in the organisation</option>
              <option value="selected">Only selected people</option>
              <option value="private">Private — only me</option>
            </select>
            {f.visibility === "selected" && <div className="max-h-40 overflow-auto rounded-lg border border-line">
              {people.map((p) => <label key={p._id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-purple-50">
                <input type="checkbox" checked={f.audience.includes(p._id)} onChange={() => toggleAudience(p._id)} />{p.name}<small className="text-muted">{p.email}</small></label>)}
            </div>}
            <p className="text-xs text-muted">
              {f.visibility === "everyone" ? "Everyone is notified." : f.visibility === "selected" ? `${f.audience.length} selected — only they are notified.` : "Nobody else sees or is notified about this event."}
            </p>
          </div>}

          {readOnly && <p className="text-xs text-muted">{f.scope === "org" ? "Organisation event" : "Event"} · {f.visibility === "selected" ? "Shared with selected people" : f.visibility === "private" ? "Private" : "Visible to everyone"}</p>}

          {!f._id && !readOnly && <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.meet} onChange={(e) => setF({ ...f, meet: e.target.checked })} />Add a Meet video link</label>}
          {f.googleMeetLink && (new Date(f.end).getTime() <= Date.now()
            ? <p className="text-sm text-muted">Meeting ended</p>
            : <a className="font-semibold text-brand" href={f.googleMeetLink} target="_blank" rel="noreferrer">Join Google Meet ↗</a>)}
          {f.createdBy && <p className="text-xs text-muted">Created by {f.createdBy}</p>}{err && <p className="text-sm text-red-600">{err}</p>}</div>
        {!readOnly && <div className="mt-4 flex justify-end gap-2">{f._id && <button className="btn2 mr-auto text-red-600" onClick={del}>Delete</button>}<button className="btn" onClick={save}>Save</button></div>}</Modal>}

      {editorsOpen && <EditorsModal onClose={() => setEditorsOpen(false)} onChanged={() => api("/api/calendar/access").then((a) => setCanEditOrg(Boolean(a.canEditOrg))).catch(() => {})} />}
    </div>
  );
}

/* ==========================================================================
   4. WHO CAN EDIT THE ORGANISATION CALENDAR (admin only)
   ========================================================================== */
function EditorsModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Editor[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { api("/api/calendar/editors").then(setRows).catch((e) => setErr(e.message)); }, []);

  const toggle = async (row: Editor) => {
    setBusy(row._id); setErr("");
    try {
      await api("/api/calendar/editors", { method: "PATCH", body: { userId: row._id, enabled: !row.orgCalendarEditor } });
      setRows((old) => old.map((r) => (r._id === row._id ? { ...r, orgCalendarEditor: !r.orgCalendarEditor } : r)));
      onChanged();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(""); }
  };

  const shown = rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase()));

  return <Modal title="Who can edit the Organisation calendar" onClose={onClose}>
    <p className="mb-3 text-sm text-muted">Administrators can always edit. Switch on the people you trust to add and change Organisation events.</p>
    <input className="inp mb-3 w-full" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
    <div className="max-h-72 overflow-auto rounded-lg border border-line">
      {shown.map((r) => <div key={r._id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
        <span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.name}</b><small className="block truncate text-muted">{r.email}</small></span>
        {r.role === "admin"
          ? <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">Admin</span>
          : <button
              role="switch" aria-checked={r.orgCalendarEditor} disabled={busy === r._id} onClick={() => toggle(r)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${r.orgCalendarEditor ? "bg-brand" : "bg-slate-300"} disabled:opacity-60`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.orgCalendarEditor ? "left-[22px]" : "left-0.5"}`} />
            </button>}
      </div>)}
      {!shown.length && <p className="p-6 text-center text-sm text-muted">No people found.</p>}
    </div>
    {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    <div className="mt-4 flex justify-end"><button className="btn" onClick={onClose}>Done</button></div>
  </Modal>;
}
