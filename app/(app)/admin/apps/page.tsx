"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type AppKey =
  | "drive"
  | "docs"
  | "sheets"
  | "calendar"
  | "meet"
  | "chat"
  | "email";

type WorkspaceApps = Record<AppKey, boolean>;

const APP_LIST: {
  key: AppKey;
  name: string;
  description: string;
  icon: string;
  category: string;
}[] = [
  {
    key: "drive",
    name: "Drive",
    description: "Store and manage company files and folders.",
    icon: "📁",
    category: "Productivity",
  },
  {
    key: "docs",
    name: "Docs",
    description: "Create and collaborate on documents.",
    icon: "📄",
    category: "Productivity",
  },
  {
    key: "sheets",
    name: "Sheets",
    description: "Create and manage spreadsheets.",
    icon: "📊",
    category: "Productivity",
  },
  {
    key: "calendar",
    name: "Calendar",
    description: "Manage meetings, events and schedules.",
    icon: "📅",
    category: "Communication",
  },
  {
    key: "meet",
    name: "Meet",
    description: "Access workspace meetings.",
    icon: "🎥",
    category: "Communication",
  },
  {
    key: "chat",
    name: "Chat",
    description: "Communicate with your team.",
    icon: "💬",
    category: "Communication",
  },
  {
    key: "email",
    name: "Email",
    description: "Access your company email account.",
    icon: "✉️",
    category: "Communication",
  },
];

const DEFAULT_APPS: WorkspaceApps = {
  drive: true,
  docs: true,
  sheets: true,
  calendar: true,
  meet: true,
  chat: true,
  email: true,
};

export default function AdminAppsPage() {
  const [apps, setApps] = useState<WorkspaceApps>(DEFAULT_APPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AppKey | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadApps = useCallback(async () => {
    try {
      const data = await api("/api/admin/apps");
      if (data?.apps) {
        setApps({ ...DEFAULT_APPS, ...data.apps });
      }
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load application settings.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function toggleApp(key: AppKey) {
    if (saving) return;

    const nextValue = !apps[key];
    setSaving(key);

    try {
      const data = await api("/api/admin/apps", {
        method: "PATCH",
        body: {
          app: key,
          enabled: nextValue,
        },
      });

      if (data?.apps) {
        setApps({ ...DEFAULT_APPS, ...data.apps });
      } else {
        setApps((current) => ({ ...current, [key]: nextValue }));
      }

      setToast({
        type: "success",
        message: `${APP_LIST.find((app) => app.key === key)?.name} ${
          nextValue ? "enabled" : "disabled"
        } successfully.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update application.",
      });
    } finally {
      setSaving(null);
    }
  }

  const enabledCount = APP_LIST.filter((app) => apps[app.key]).length;
  const disabledCount = APP_LIST.length - enabledCount;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {toast && (
        <div
          className={`fixed right-5 top-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "border-green-200 bg-white text-green-700"
              : "border-red-200 bg-white text-red-700"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-blue-600">Admin Console</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
          Applications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Control which workspace applications employees can access.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total applications</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {APP_LIST.length}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Enabled</p>
          <p className="mt-2 text-3xl font-semibold text-green-600">
            {enabledCount}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Disabled</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {disabledCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Workspace applications
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Switch an application on or off for employees.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading application settings...
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {APP_LIST.map((app) => {
              const enabled = apps[app.key];
              const isSaving = saving === app.key;

              return (
                <div
                  key={app.key}
                  className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xl">
                    {app.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {app.name}
                      </h3>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        {app.category}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {app.description}
                    </p>
                    <p
                      className={`mt-1 text-xs font-medium ${
                        enabled ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {isSaving
                        ? "Saving..."
                        : enabled
                          ? "Enabled for employees"
                          : "Disabled for employees"}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${app.name}`}
                    disabled={saving !== null}
                    onClick={() => toggleApp(app.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      enabled ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-gray-400">
        Application availability is controlled through workspace settings.
        Disabling an application should also be enforced by its employee-facing
        pages and APIs.
      </p>
    </div>
  );
}
