import "server-only";
import { Notification } from "@/lib/models";

export type NotifyInput = {
  type: "calendar" | "meeting" | "chat" | "system";
  title: string;
  body?: string;
  link?: string;
  // Same key + still unread = one notification with a counter.
  key?: string;
};

/* ==========================================================================
   Creates in-app notifications. Never throws: a notification problem must
   not stop an event, a meeting or a chat message from being saved.
   ========================================================================== */
export async function notifyUsers(userIds: string[], input: NotifyInput) {
  const users = [...new Set(userIds.map(String))].filter((id) =>
    /^[a-f0-9]{24}$/i.test(id),
  );

  if (!users.length) return;

  const title = input.title.slice(0, 160);
  const body = (input.body || "").slice(0, 300);
  const link = input.link || "";

  try {
    if (input.key) {
      await Notification.bulkWrite(
        users.map((user) => ({
          updateOne: {
            filter: { user, key: input.key, read: false },
            update: {
              $set: { type: input.type, title, body, link, createdAt: new Date() },
              $inc: { count: 1 },
            },
            upsert: true,
          },
        })),
      );
      return;
    }

    await Notification.insertMany(
      users.map((user) => ({ user, type: input.type, title, body, link })),
    );
  } catch (error) {
    console.error("Notification creation failed:", error);
  }
}
