import { guard, J } from "@/lib/http";
import { WorkspaceSettings } from "@/lib/models";

const DEFAULT_APPS = {
  drive: true,
  docs: true,
  sheets: true,
  calendar: true,
  meet: true,
  chat: true,
  email: true,
};

const APP_KEYS = Object.keys(DEFAULT_APPS) as Array<keyof typeof DEFAULT_APPS>;

// GET: Read workspace application settings.
export const GET = guard(async () => {
  const settings = await WorkspaceSettings.findOne({
    key: "workspace",
  }).lean();

  if (!settings) {
    const created = await WorkspaceSettings.create({
      key: "workspace",
      apps: DEFAULT_APPS,
    });

    return J({
      apps: {
        ...DEFAULT_APPS,
        ...created.apps.toObject?.(),
      },
    });
  }

  const workspaceApps =
    !Array.isArray(settings) && settings.apps ? settings.apps : {};

  return J({
    apps: {
      ...DEFAULT_APPS,
      ...workspaceApps,
    },
  });
}, true);

// PATCH: Update one application toggle.
export const PATCH = guard(async (req, session) => {
  const body = await req.json();

  const app = String(body.app || "");
  const enabled = body.enabled;

  if (!APP_KEYS.includes(app as keyof typeof DEFAULT_APPS)) {
    throw new Error("Invalid application.");
  }

  if (typeof enabled !== "boolean") {
    throw new Error("Application status must be true or false.");
  }

  const settings = await WorkspaceSettings.findOneAndUpdate(
    { key: "workspace" },
    {
      $set: {
        [`apps.${app}`]: enabled,
        updatedBy: String(session.sub),
      },
      $setOnInsert: {
        key: "workspace",
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).lean();

  const workspaceApps =
    settings && !Array.isArray(settings) && settings.apps ? settings.apps : {};

  return J({
    ok: true,
    message: `${app.charAt(0).toUpperCase() + app.slice(1)} has been ${
      enabled ? "enabled" : "disabled"
    }.`,
    apps: {
      ...DEFAULT_APPS,
      ...workspaceApps,
    },
  });
}, true);
