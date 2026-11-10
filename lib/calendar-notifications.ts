import "server-only";
import { User } from "@/lib/models";
import { sendCalendarNotificationEmail } from "@/lib/email";
import { notifyUsers } from "@/lib/notify";

/* ==========================================================================
   Sends the in-app notification and the email for a calendar entry.

   recipientIds = only these people are told (selected audience).
   recipientIds undefined = everybody active (Everyone visibility).
   Personal and private entries never call this function.
   ========================================================================== */
export async function notifyWorkspaceCalendar(args: {
  title: string; description?: string; start: Date; end: Date;
  meetLink?: string; action: "created" | "updated" | "cancelled";
  excludeUserId?: string;
  recipientIds?: string[];
  kind?: "event" | "meeting";
}) {
  const query: any = { active: true };
  if (args.recipientIds) query._id = { $in: args.recipientIds };

  const users = await User.find(query)
    .select("name personalEmail email")
    .lean();

  const people = users.filter(
    (user: any) => String(user._id) !== String(args.excludeUserId),
  );

  // In-app notification (bell icon).
  const verb = { created: "New", updated: "Updated", cancelled: "Cancelled" }[args.action];
  const noun = args.kind === "meeting" ? "meeting" : "event";
  await notifyUsers(
    people.map((user: any) => String(user._id)),
    {
      type: args.kind === "meeting" ? "meeting" : "calendar",
      title: `${verb} ${noun}: ${args.title}`,
      body: args.start.toLocaleString("en-IN", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
      }),
      link: args.kind === "meeting" ? "/meet" : "/calendar",
    },
  );

  // Email notification.
  const recipients = people.filter((user: any) => user.personalEmail);
  const results = await Promise.allSettled(recipients.map((user: any) =>
    sendCalendarNotificationEmail({
      name: user.name || "there",
      personalEmail: user.personalEmail,
      title: args.title,
      description: args.description || "",
      start: args.start,
      end: args.end,
      meetLink: args.meetLink || "",
      action: args.action,
    })
  ));
  const failed = results.filter((result) => result.status === "rejected").length;
  if (failed) console.error(`Calendar email notifications failed for ${failed} recipient(s).`);
  return { sent: results.length - failed, failed };
}
