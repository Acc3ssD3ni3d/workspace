"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import ShareDialog from "./ShareDialog";

/* ---- spreadsheet formulas: + - * / SUM() AVG() cell refs and ranges (A–J) ---- */
const rng = (a: string, r1: number, b: string, r2: number) => { const o: string[] = []; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) for (let r = r1; r <= r2; r++) o.push(String.fromCharCode(c) + r); return o; };
function calc(c: Record<string, string>, ref: string, d = 0): any {
  const raw = c[ref]; if (raw == null || raw === "") return "";
  if (raw[0] !== "=") return isNaN(+raw) ? raw : +raw; if (d > 8) return "#LOOP";
  const x = raw.slice(1).toUpperCase().replace(/([A-J])(\d+):([A-J])(\d+)/g, (_m, a, b, e, f) => "[" + rng(a, +b, e, +f).map((k) => `V("${k}")`).join(",") + "]").replace(/\b([A-J]\d+)\b/g, 'V("$1")').replace(/SUM\(/g, "S(").replace(/AVG\(/g, "M(");
  if (!/^[0-9+\-*/().,\s\[\]"A-JVSM]*$/.test(x)) return "#ERR";
  try { return new Function("V", "S", "M", "return " + x)((k: string) => +calc(c, k, d + 1) || 0, (a: any) => [a].flat(9).reduce((p: number, q: any) => p + (+q || 0), 0), (a: any) => { const f = [a].flat(9); return f.reduce((p: number, q: any) => p + (+q || 0), 0) / f.length; }); } catch { return "#ERR"; }
}

export default function Editor({ id }: { id: string }) {
  const router = useRouter(), [d, setD] = useState<any>(null), [share, setShare] = useState(false), [status, setStatus] = useState("Saved");
  const dirty = useRef(false), latest = useRef<any>(null), timer = useRef<any>(), el = useRef<HTMLDivElement>(null);
  // Collaboration: poll every 5s and pull others' changes when we have no unsaved edits
  const pull = async () => { try { const x = await api(`/api/docs/${id}`); setD((p: any) => { if (!p || (!dirty.current && x.rev !== p.rev)) { latest.current = x; return x; } return p; }); } catch {} };
  useEffect(() => { pull(); const t = setInterval(pull, 5000); return () => clearInterval(t); }, [id]);
  useEffect(() => { const e = el.current; if (d?.kind === "doc" && e && e.innerHTML !== d.content && document.activeElement !== e) e.innerHTML = d.content; }, [d]);
  if (!d) return <p className="text-muted">Loading…</p>;
  const canEdit = d.myRole === "owner" || d.myRole === "edit";
  const change = (patch: any) => {
    dirty.current = true; setStatus("Saving…"); latest.current = { ...latest.current, ...patch }; setD((p: any) => ({ ...p, ...patch })); clearTimeout(timer.current);
    timer.current = setTimeout(async () => { try { const r = await api(`/api/docs/${id}`, { method: "PUT", body: { title: latest.current.title, content: latest.current.content } }); latest.current.rev = r.rev; setD((p: any) => ({ ...p, rev: r.rev })); dirty.current = false; setStatus("Saved"); } catch (e: any) { setStatus(e.message); } }, 800);
  };
  const cells: Record<string, string> = d.kind === "sheet" ? JSON.parse(d.content || "{}") : {}, cols = "ABCDEFGHIJ".split("");
  const B = (l: string, c: string, a?: string) => <button className="btn2 px-3 py-1" onMouseDown={(e) => { e.preventDefault(); document.execCommand(c, false, a); }}>{l}</button>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn2" onClick={() => router.push(d.kind === "doc" ? "/docs" : "/sheets")}>← Back</button>
        <input className="inp min-w-0 flex-1 text-lg font-bold" value={d.title} disabled={!canEdit} onChange={(e) => change({ title: e.target.value })} />
        <span className="text-sm text-muted">{canEdit ? status : "View only"}</span>
        {d.myRole === "owner" && <><button className="btn" onClick={() => setShare(true)}>Share</button><button className="btn2 text-red-600" onClick={async () => { if (confirm("Delete this file?")) { await api(`/api/docs/${id}`, { method: "DELETE" }); router.push(d.kind === "doc" ? "/docs" : "/sheets"); } }}>Delete</button></>}
      </div>
      {d.kind === "doc" ? <>
        {canEdit && <div className="flex flex-wrap gap-1.5">{B("B", "bold")}{B("I", "italic")}{B("U", "underline")}{B("H1", "formatBlock", "h1")}{B("H2", "formatBlock", "h2")}{B("• List", "insertUnorderedList")}{B("1. List", "insertOrderedList")}</div>}
        <div ref={el} contentEditable={canEdit} suppressContentEditableWarning onInput={(e) => change({ content: (e.target as HTMLElement).innerHTML })} className="card mx-auto min-h-[60vh] max-w-3xl p-6 outline-none sm:p-12 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:text-2xl [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6" />
      </> : <>
        <p className="text-sm text-muted">Formulas: =B2+C2, =SUM(B2:B5), =AVG(B2:B5)</p>
        <div className="card overflow-auto"><table className="border-collapse text-sm"><thead><tr><th className="bg-blue-50 px-2" />{cols.map((c) => <th key={c} className="bg-blue-50 px-2 py-1">{c}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 30 }, (_, i) => <tr key={i}><th className="bg-blue-50 px-2">{i + 1}</th>{cols.map((c) => { const r = c + (i + 1); return <td key={r} className="border border-line p-0">
            <input key={r + d.rev} className="w-28 border-0 px-2 py-1.5 outline-brand" disabled={!canEdit} defaultValue={String(calc(cells, r))}
              onFocus={(e) => (e.target.value = cells[r] || "")}
              onBlur={(e) => { const v = e.target.value; if (v !== (cells[r] || "")) change({ content: JSON.stringify({ ...cells, [r]: v }) }); else e.target.value = String(calc(cells, r)); }} /></td>; })}</tr>)}</tbody></table></div>
      </>}
      {share && <ShareDialog item={d} base="/api/docs" onClose={() => { setShare(false); pull(); }} />}
    </div>
  );
}
