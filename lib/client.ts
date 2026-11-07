const recentGets = new Map<string, { at: number; promise: Promise<any> }>();

export async function api(u: string, o: { method?: string; body?: any; signal?: AbortSignal } = {}) {
  const method = o.method || "GET";
  if (method === "GET" && !o.signal) {
    const cached = recentGets.get(u);
    if (cached && Date.now() - cached.at < 700) return cached.promise;
  }

  const request = (async () => {
    const r = await fetch(u, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      signal: o.signal,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  })();

  if (method === "GET" && !o.signal) {
    recentGets.set(u, { at: Date.now(), promise: request });
    try { return await request; }
    finally {
      window.setTimeout(() => {
        if (recentGets.get(u)?.promise === request) recentGets.delete(u);
      }, 750);
    }
  }
  return request;
}
export const sizeFmt = (b: number) => b >= 1e9 ? (b / 1e9).toFixed(1) + " GB" : b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : b ? Math.round(b / 1e3) + " KB" : "—";
