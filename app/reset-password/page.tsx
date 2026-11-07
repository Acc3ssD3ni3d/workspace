"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    const token = new URLSearchParams(window.location.search).get("token") || "";
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to reset password.");
      setMessage(data.message || "Password reset successfully.");
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-navy to-[#1f3b9c] p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div>
          <h1 className="text-2xl font-extrabold">Set a new password</h1>
          <p className="text-muted mt-1 text-sm">Choose a new password for your EduOne Workspace account.</p>
        </div>
        {!complete && <>
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (min. 8 characters)" className="inp w-full" />
          <input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="inp w-full" />
        </>}
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!complete ? <button disabled={busy} className="btn w-full">{busy ? "Updating…" : "Reset password"}</button> : <Link href="/login" className="btn block w-full text-center">Go to sign in</Link>}
      </form>
    </main>
  );
}
