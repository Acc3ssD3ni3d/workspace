import { guard, J } from "@/lib/http";
import { google } from "googleapis";
import { getGoogleClient } from "@/lib/google-tokens";

export const GET = guard(async (req, session) => {
  const space = new URL(req.url).searchParams.get("space");
  if (!space || !/^spaces\/[A-Za-z0-9_-]+$/.test(space)) throw new Error("Choose a valid Google Chat space.");
  const auth = await getGoogleClient(session.sub);
  const chat = google.chat({ version: "v1", auth });
  const response = await chat.spaces.messages.list({
    parent: space, pageSize: 50, orderBy: "createTime desc",
  });
  return J((response.data.messages || []).reverse().map((message: any) => ({
    name: message.name, text: message.text || "",
    sender: message.sender?.displayName || message.sender?.name || "Google Chat user",
    createTime: message.createTime || "",
  })));
});

export const POST = guard(async (req, session) => {
  const body = await req.json();
  const space = String(body.space || "");
  const text = String(body.text || "").trim();
  if (!/^spaces\/[A-Za-z0-9_-]+$/.test(space) || !text || text.length > 4000) {
    throw new Error("Choose a valid space and enter a message under 4,000 characters.");
  }
  const auth = await getGoogleClient(session.sub);
  const chat = google.chat({ version: "v1", auth });
  const response = await chat.spaces.messages.create({
    parent: space, requestBody: { text },
  });
  return J({
    name: response.data.name, text: response.data.text || text,
    sender: session.name, createTime: response.data.createTime || new Date().toISOString(),
  }, 201);
});
