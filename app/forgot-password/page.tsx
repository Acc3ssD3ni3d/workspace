"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send reset link.");
      setMessage(data.message || "If your account is eligible, a reset link will be sent shortly.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-navy to-[#1f3b9c] p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-7">
        <div>
          <h1 className="text-2xl font-extrabold">Forgot password?</h1>
          <p className="text-muted mt-1 text-sm">Enter your company email. We’ll send a reset link to your registered personal email address.</p>
        </div>
        <label className="block space-y-1 text-sm font-medium">Company email
          <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@eduoneinternational.com" className="inp w-full" />
        </label>
        {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="btn w-full">{busy ? "Sending…" : "Send reset link"}</button>
        <p className="text-center text-sm"><Link href="/login" className="font-semibold text-blue-600 hover:underline">Back to sign in</Link></p>
      </form>
    </main>
  );
}
