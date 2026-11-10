import { getSession } from "@/lib/auth";
import Chat from "@/components/Chat";

// ?channel=group:<id> | dm:<a>:<b> | general   (used by notification links)
export default async function ChatPage({
  searchParams,
}: {
  searchParams: { channel?: string };
}) {
  const s = await getSession();
  return <Chat me={s!.sub} initialChannel={searchParams?.channel || "general"} />;
}
