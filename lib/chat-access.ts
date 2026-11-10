import "server-only";
import { ChatGroup } from "@/lib/models";

/* ==========================================================================
   CHANNEL IDS
   general            -> everybody
   dm:<idA>:<idB>     -> only those two people
   group:<groupId>    -> only the members of that group
   ========================================================================== */
export async function canAccessChannel(channel: string, userId: string) {
  if (channel === "general") return true;

  if (channel.startsWith("dm:")) {
    const parts = channel.split(":").slice(1);
    return parts.length === 2 && parts.includes(userId);
  }

  if (channel.startsWith("group:")) {
    const id = channel.slice(6);
    if (!/^[a-f0-9]{24}$/i.test(id)) return false;
    return Boolean(await ChatGroup.exists({ _id: id, members: userId }));
  }

  return false;
}

// Everyone who should be notified about a new message (never the sender).
export async function channelRecipients(channel: string, senderId: string) {
  if (channel.startsWith("dm:")) {
    return channel.split(":").slice(1).filter((id) => id !== senderId);
  }

  if (channel.startsWith("group:")) {
    const group: any = await ChatGroup.findById(channel.slice(6))
      .select("members name")
      .lean();
    return (group?.members || [])
      .map((member: any) => String(member))
      .filter((id: string) => id !== senderId);
  }

  return [];
}
