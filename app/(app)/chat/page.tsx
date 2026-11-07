import { getSession } from "@/lib/auth";
import Chat from "@/components/Chat";
export default async function ChatPage() { const s = await getSession(); return <Chat me={s!.sub} />; }
