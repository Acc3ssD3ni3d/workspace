import { guard, J } from "@/lib/http";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google-tokens";

export const GET = guard(async (_req, session) => {
  const auth = await getGoogleClient(session.sub);
  const chat = google.chat({ version: "v1", auth });
  const response = await chat.spaces.list({ pageSize: 100 });
  return J((response.data.spaces || []).map((space: any) => ({
    name: space.name, displayName: space.displayName || space.name,
    type: space.type || "", spaceType: space.spaceType || "",
  })));
});
