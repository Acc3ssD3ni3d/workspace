import { Item } from "./models";
import type { Session } from "./auth";

export type PermissionRole = "owner" | "edit" | "view" | null;

/**
 * Resolves permissions directly on one item.
 *
 * Admins retain the existing full-access behaviour.
 * Owners always have full access.
 */
function directPermission(item: any, session: Session): PermissionRole {
  if (session.role === "admin") {
    return "owner";
  }

  if (String(item.owner) === String(session.sub)) {
    return "owner";
  }

  const directShare = item.shared?.find(
    (entry: any) => String(entry.user) === String(session.sub),
  );

  if (directShare) {
    return directShare.role === "edit" ? "edit" : "view";
  }

  if (item.org === "edit") {
    return "edit";
  }

  if (item.org === "view") {
    return "view";
  }

  return null;
}

/**
 * Resolves permissions for an item.
 *
 * Permissions inherited from parent folders are supported.
 * A permission directly assigned to a child takes priority
 * over permissions inherited from its parent.
 */
export async function roleOf(
  item: any,
  session: Session,
): Promise<PermissionRole> {
  let current = item;

  const visited = new Set<string>();

  for (let depth = 0; depth < 30 && current; depth++) {
    const currentId = String(current._id);

    // Prevent accidental circular folder references.
    if (visited.has(currentId)) {
      break;
    }

    visited.add(currentId);

    const permission = directPermission(current, session);

    if (permission) {
      return permission;
    }

    if (!current.parent) {
      break;
    }

    current = await Item.findById(current.parent)
      .select("_id owner parent shared org")
      .lean();
  }

  return null;
}

/**
 * Loads an item only if the session has the required permission.
 *
 * view  = owner, editor or viewer
 * edit  = owner or editor
 * owner = owner only
 */
export async function load(
  Model: any,
  id: string,
  session: Session,
  required: "view" | "edit" | "owner" = "view",
) {
  const item = await Model.findById(id);

  if (!item) {
    throw new Error("Not found.");
  }

  const permission = await roleOf(item, session);

  const allowed =
    permission === "owner" ||
    (permission === "edit" && required !== "owner") ||
    (permission === "view" && required === "view");

  if (!allowed) {
    throw new Error("You do not have permission to access this item.");
  }

  return item;
}
