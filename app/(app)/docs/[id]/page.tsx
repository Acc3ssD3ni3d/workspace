import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Item } from "@/lib/models";
import { load } from "@/lib/perm";

export default async function DocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  try {
    const item = await load(Item, params.id, session);

    if (
      item.storageProvider !== "google" ||
      item.googleResourceType !== "document" ||
      !item.googleFileId
    ) {
      notFound();
    }

    const url =
      item.googleWebViewLink ||
      `https://docs.google.com/document/d/${item.googleFileId}/edit`;

    redirect(url);
  } catch {
    notFound();
  }
}
