"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Login() {
  const r = useRouter(), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))) });
    if (res.ok) { r.push("/"); r.refresh(); } else { setErr((await res.json()).error); setBusy(false); }
  }
  return (
    <div className="grid min-h-screen place-items-center bg-page p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div><span className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-brand text-xl font-bold text-white">E</span><h1 className="text-2xl font-extrabold">EduOne Workspace</h1><p className="text-muted">Sign in with your company email</p></div>
        <input name="email" type="email" required placeholder="you@eduoneinternational.com" className="inp w-full" />
        <input name="password" type="password" required placeholder="Password" className="inp w-full" />
        <div className="-mt-2 text-right">
          <a href="/forgot-password" className="text-sm font-semibold text-blue-600 hover:underline">Forgot password?</a>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} className="btn w-full">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
