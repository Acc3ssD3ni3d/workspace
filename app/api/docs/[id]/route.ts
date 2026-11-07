import { guard, J } from "@/lib/http";
import { Doc, Item } from "@/lib/models";
import { load, roleOf } from "@/lib/perm";

export const GET = guard(async (_r, s, { params }) => {
  const d = await load(Doc, params.id, s);

  return J({
    ...d.toObject(),
    myRole: await roleOf(d, s),
  });
});

export const PUT = guard(async (req, s, { params }) => {
  const b = await req.json();
  const d = await load(Doc, params.id, s, "edit");

  if (typeof b.title === "string") {
    d.title = b.title.trim().slice(0, 200) || "Untitled";
  }

  if (typeof b.content === "string") {
    d.content = b.content;
  }

  d.rev += 1;
  d.updatedBy = s.name;

  await d.save();

  const size = Buffer.byteLength(d.content || "", "utf8");

  await Item.updateOne(
    { _id: d._id },
    {
      $set: {
        name: d.title,
        size,
        uploaded: size,
      },
    },
  );

  return J({ rev: d.rev });
});

export const PATCH = guard(async (req, s, { params }) => {
  const b = await req.json();
  const d = await load(Doc, params.id, s, "owner");

  if (Array.isArray(b.shared)) {
    d.shared = b.shared.map((x: any) => ({
      user: x.user,
      role: x.role === "edit" ? "edit" : "view",
    }));
  }

  if (["none", "view", "edit"].includes(b.org)) {
    d.org = b.org;
  }

  await d.save();

  await Item.updateOne(
    { _id: d._id },
    {
      $set: {
        shared: d.shared,
        org: d.org,
      },
    },
  );

  return J(d);
});

export const DELETE = guard(async (_r, s, { params }) => {
  const d = await load(Doc, params.id, s, "owner");

  await Doc.deleteOne({ _id: d._id });
  await Item.deleteOne({ _id: d._id });

  return J({ ok: true });
});
