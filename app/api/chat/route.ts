import { guard, J } from "@/lib/http";
import { Message } from "@/lib/models";
// channel = "general" or "dm:<idA>:<idB>" (only those two people can read it)
const allowed = (c: string, sub: string) => c === "general" || (c.startsWith("dm:") && c.split(":").slice(1).includes(sub));
export const GET = guard(async (req, s) => {
  const u = new URL(req.url), c = u.searchParams.get("channel") || "general", after = u.searchParams.get("after");
  if (!allowed(c, s.sub)) throw new Error("No access");
  return J(await Message.find({ channel: c, ...(after ? { createdAt: { $gt: new Date(after) } } : {}) }).sort({ createdAt: 1 }).limit(200));
});
export const POST = guard(async (req, s) => {
  const { channel, text } = await req.json();
  if (!allowed(channel, s.sub) || !String(text || "").trim()) throw new Error("Invalid message");
  return J(await Message.create({ channel, from: s.sub, name: s.name, text: String(text).slice(0, 4000) }), 201);
});
