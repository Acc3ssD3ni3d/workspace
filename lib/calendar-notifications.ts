import "server-only";
import { User } from "@/lib/models";
import { sendCalendarNotificationEmail } from "@/lib/email";

export async function notifyWorkspaceCalendar(args: {
  title: string; description?: string; start: Date; end: Date;
  meetLink?: string; action: "created" | "updated" | "cancelled";
  excludeUserId?: string;
}) {
  const users = await User.find({ active: true })
    .select("name personalEmail email")
    .lean();
  const recipients = users.filter((user: any) =>
    user.personalEmail && String(user._id) !== String(args.excludeUserId)
  );
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
