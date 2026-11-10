"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

/* ==========================================================================
   2. TYPES AND HELPERS
   ========================================================================== */
type Meeting = {
  _id: string; title: string; start: string; end: string;
  createdBy: string; googleMeetLink: string;
  meetingStatus: "scheduled" | "live" | "ended" | "cancelled";
  visibility?: "everyone" | "selected" | "private";
  invited?: string[];
  mine?: boolean;
};

type Person = { _id: string; name: string; email: string };
type Group = { _id: string; name: string; members: { _id: string; name: string }[] };
type Invite = "everyone" | "people" | "group";

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* ==========================================================================
   3. COMPONENT
   ========================================================================== */
export default function MeetRoom({ name, me }: { name: string; me: string }) {
  const [title, setTitle] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [mode, setMode] = useState<"instant" | "schedule">("instant");
  const [start, setStart] = useState(() => localInput(new Date(Date.now() + 30 * 60000)));
  const [end, setEnd] = useState(() => localInput(new Date(Date.now() + 90 * 60000)));

  // Who is invited
  const [invite, setInvite] = useState<Invite>("everyone");
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");

  /* ---------- load ---------- */
  const loadMeetings = useCallback(async () => {
    try { setMeetings(await api("/api/meet")); }
    catch (e: any) { setError(e.message || "Unable to load meetings."); }
  }, []);
  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  useEffect(() => {
    api("/api/directory").then((rows: Person[]) => setPeople(rows.filter((p) => p._id !== me))).catch(() => {});
    api("/api/chat/groups").then(setGroups).catch(() => {});
  }, [me]);

  const togglePerson = (id: string) =>
    setPicked((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);

  /* ---------- create ---------- */
  const createMeeting = async () => {
    setError("");

    if (invite === "people" && !picked.length) return setError("Choose at least one person.");
    if (invite === "group" && !groupId) return setError("Choose a group.");

    setLoading(true);
    try {
      const audience = invite === "everyone"
        ? {}
        : invite === "people"
          ? { visibility: "selected", audience: picked }
          : { visibility: "selected", groupId };

      const payload = mode === "schedule"
        ? await api("/api/events", { method: "POST", body: {
            title: title.trim() || `Meeting - ${name}`,
            desc: "", start: new Date(start), end: new Date(end), meet: true,
            kind: "meeting", visibility: "everyone", ...audience,
          } })
        : await api("/api/meet", { method: "POST", body: {
            title: title.trim() || `Quick meeting - ${name}`, visibility: "everyone", ...audience,
          } });

      setTitle("");
      await loadMeetings();
      const link = mode === "schedule" ? payload.event?.googleMeetLink : payload.googleMeetLink;
      if (mode === "instant" && link) window.open(link, "_blank", "noopener,noreferrer");
      else if (link) setError("Meeting scheduled successfully. Invited people were notified and can see it below.");
    } catch (e: any) { setError(e.message || "Unable to create meeting."); }
    finally { setLoading(false); }
  };

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); window.setTimeout(() => setCopied(""), 1800); }
    catch { setError("Unable to copy the meeting link."); }
  };

  const statusLabel = (meeting: Meeting) => {
    const now = Date.now(), s = new Date(meeting.start).getTime(), e = new Date(meeting.end).getTime();
    if (e <= now) return "Ended";
    if (s > now) return "Scheduled";
    return "Live";
  };

  const audienceLabel = (meeting: Meeting) =>
    meeting.visibility === "selected"
      ? `Private · ${meeting.invited?.length || 0} invited`
      : "Everyone";

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-extrabold">Google Meet</h1>
      <p className="mt-1 text-sm text-muted">Start an instant meeting or schedule one. Choose everyone, specific people or a group.</p></div>

    {/* Create */}
    <section className="card space-y-4 p-5">
      <div><h2 className="text-lg font-bold">Create a meeting</h2>
        <p className="mt-1 text-sm text-muted">Meet links are generated by your connected Google account.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={mode === "instant" ? "btn" : "btn2"} onClick={() => setMode("instant")}>Start now</button>
        <button className={mode === "schedule" ? "btn" : "btn2"} onClick={() => setMode("schedule")}>Schedule</button>
      </div>
      <input className="inp w-full" value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="Meeting title" />
      {mode === "schedule" && <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Start date & time<input type="datetime-local" className="inp mt-1 w-full" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="text-sm">End date & time<input type="datetime-local" className="inp mt-1 w-full" value={end} onChange={e => setEnd(e.target.value)} /></label>
      </div>}

      {/* Who is invited */}
      <div className="space-y-2 rounded-lg border border-line p-3">
        <p className="text-sm font-semibold">Who is this meeting for?</p>
        <div className="flex flex-wrap gap-2">
          <button className={invite === "everyone" ? "btn" : "btn2"} onClick={() => setInvite("everyone")}>Everyone</button>
          <button className={invite === "people" ? "btn" : "btn2"} onClick={() => setInvite("people")}>Selected people</button>
          <button className={invite === "group" ? "btn" : "btn2"} onClick={() => setInvite("group")}>A group</button>
        </div>

        {invite === "people" && <div className="max-h-44 overflow-auto rounded-lg border border-line">
          {people.map((p) => <label key={p._id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-blue-50">
            <input type="checkbox" checked={picked.includes(p._id)} onChange={() => togglePerson(p._id)} />{p.name}<small className="text-muted">{p.email}</small></label>)}
          {!people.length && <p className="p-3 text-xs text-muted">No other members found.</p>}
        </div>}

        {invite === "group" && (groups.length
          ? <select className="inp w-full" value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">Choose a group…</option>
              {groups.map((g) => <option key={g._id} value={g._id}>{g.name} ({g.members.length} members)</option>)}
            </select>
          : <p className="text-xs text-muted">You are not in any group yet. Create one in Chat first.</p>)}

        <p className="text-xs text-muted">
          {invite === "everyone"
            ? "Everyone in the workspace is notified and sees this meeting."
            : "Only the invited people are notified and see this meeting. Nobody else is alerted."}
        </p>
      </div>

      <button className="btn" onClick={createMeeting} disabled={loading}>{loading ? "Please wait…" : mode === "instant" ? "Create Google Meet" : "Schedule Google Meet"}</button>
      {error && <p role="status" className="text-sm text-blue-700">{error}</p>}
    </section>

    {/* List */}
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Your meetings</h2><button className="btn2" onClick={loadMeetings}>Refresh</button></div>
      {meetings.length === 0 ? <div className="card p-6 text-center text-sm text-muted">No meetings yet.</div> :
        meetings.map(meeting => {
          const status = statusLabel(meeting);
          return <article key={meeting._id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{meeting.title}</h3>
                <span className={`rounded-full px-2 py-1 text-xs ${status === "Live" ? "bg-green-100 text-green-700" : status === "Ended" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700"}`}>{status}</span>
                <span className={`rounded-full px-2 py-1 text-xs ${meeting.visibility === "selected" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{audienceLabel(meeting)}</span></div>
              <p className="mt-1 text-xs text-muted">{new Date(meeting.start).toLocaleString()} – {new Date(meeting.end).toLocaleTimeString()} · Created by {meeting.createdBy || "Workspace member"}</p>
              {meeting.visibility === "selected" && !!meeting.invited?.length &&
                <p className="mt-1 truncate text-xs text-muted">Invited: {meeting.invited.join(", ")}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn2" onClick={() => copyLink(meeting.googleMeetLink)}>{copied === meeting.googleMeetLink ? "Copied" : "Copy link"}</button>
              {status !== "Ended" && <a className="btn" href={meeting.googleMeetLink} target="_blank" rel="noreferrer">Join Google Meet ↗</a>}
            </div>
          </article>;
        })}
    </section>
  </div>;
}
