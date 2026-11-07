import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Item } from "@/lib/models";
import { load } from "@/lib/perm";

export default async function SpreadsheetPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  await connectDB();

  let item;

  try {
    item = await load(Item, params.id, session);
  } catch {
    notFound();
  }

  if (
    item.storageProvider !== "google" ||
    item.googleResourceType !== "spreadsheet" ||
    !item.googleFileId
  ) {
    notFound();
  }

  const url =
    item.googleWebViewLink ||
    `https://docs.google.com/spreadsheets/d/${item.googleFileId}/edit`;

  redirect(url);
}
