import { getSession } from "@/lib/auth";
import MeetRoom from "@/components/MeetRoom";

export default async function Meet() {
  const session = await getSession();
  return <MeetRoom name={session!.name} me={session!.sub} />;
}
