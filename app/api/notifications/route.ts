import { guard, J } from "@/lib/http";
import { Notification } from "@/lib/models";

/* ==========================================================================
   GET    /api/notifications?limit=30
          -> { items, unread, unreadByKey }
   PATCH  { ids?: string[], key?: string, all?: boolean }  mark as read
   DELETE ?all=1  remove the notifications that were already read
   ========================================================================== */
export const GET = guard(async (req, session) => {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 30, 100);

  const [items, unreadRows] = await Promise.all([
    Notification.find({ user: session.sub }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.find({ user: session.sub, read: false }).select("key count").lean(),
  ]);

  const unreadByKey: Record<string, number> = {};
  for (const row of unreadRows as any[]) {
    if (row.key) unreadByKey[row.key] = (unreadByKey[row.key] || 0) + (row.count || 1);
  }

  return J({ items, unread: unreadRows.length, unreadByKey });
});

export const PATCH = guard(async (req, session) => {
  const body = await req.json().catch(() => ({}));
  const filter: any = { user: session.sub, read: false };

  if (body.all) {
    // every unread notification of this user
  } else if (typeof body.key === "string" && body.key) {
    filter.key = body.key;
  } else if (Array.isArray(body.ids) && body.ids.length) {
    filter._id = { $in: body.ids.filter((id: unknown) => /^[a-f0-9]{24}$/i.test(String(id))) };
  } else {
    throw new Error("Nothing to mark as read.");
  }

  await Notification.updateMany(filter, { $set: { read: true } });
  return J({ ok: true });
});

export const DELETE = guard(async (_req, session) => {
  await Notification.deleteMany({ user: session.sub, read: true });
  return J({ ok: true });
});
