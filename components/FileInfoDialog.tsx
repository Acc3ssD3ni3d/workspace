"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  User,
  Users,
  Link2,
  Lock,
  Eye,
  Download,
  Upload,
  Share2,
  Pencil,
  Trash2,
  RotateCcw,
  Clock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { api, sizeFmt } from "@/lib/client";
import Modal from "@/components/Modal";

type FileInfo = {
  file: {
    id: string;
    name: string;
    type: string;
    mime: string;
    size: number;
    uploaded: number;
    createdAt?: string;
    updatedAt?: string;
    lastAccessedAt?: string | null;
    accessCount: number;
  };
  owner: {
    id: string;
    name: string;
    email: string;
  } | null;
  access: {
    isPrivate: boolean;
    people: {
      id: string;
      name: string;
      email: string;
      role: string;
      active: boolean;
      source: string;
    }[];
    organisation: {
      enabled: boolean;
      role: string;
      label: string;
    };
    link: {
      enabled: boolean;
      role: string;
      expiresAt: string | null;
      createdAt: string | null;
    };
  };
  activity: {
    id: string;
    actorName: string;
    actorEmail: string;
    action: string;
    accessMethod: string;
    details: string;
    createdAt: string;
  }[];
};

const actionIcons: Record<string, any> = {
  view: Eye,
  download: Download,
  upload: Upload,
  edit: Pencil,
  rename: Pencil,
  share: Share2,
  unshare: ShieldCheck,
  link_created: Link2,
  link_revoked: Lock,
  delete: Trash2,
  restore: RotateCcw,
};

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    view: "Viewed file",
    download: "Downloaded file",
    upload: "Uploaded file",
    edit: "Edited file",
    rename: "Renamed file",
    share: "Updated sharing permissions",
    unshare: "Removed sharing permissions",
    link_created: "Created sharing link",
    link_revoked: "Revoked sharing link",
    delete: "Deleted file",
    restore: "Restored file",
  };

  return labels[action] || action;
}

export default function FileInfoDialog({
  item,
  onClose,
}: {
  item: { _id: string; name: string };
  onClose: () => void;
}) {
  const [data, setData] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInfo = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await api(`/api/files/${item._id}/info`);

      setData(result as FileInfo);
    } catch (e: any) {
      setError(e.message || "Unable to load file information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, [item._id]);

  return (
    <Modal title="File information" wide onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto">
        {loading && (
          <div className="grid min-h-48 place-items-center">
            <div className="text-center text-sm text-slate-500">
              <RefreshCw className="mx-auto mb-3 animate-spin text-blue-600" />
              Loading file information...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button onClick={loadInfo} className="ml-3 font-semibold underline">
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* FILE DETAILS */}
            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText size={23} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-slate-900">
                    {data.file.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {data.file.mime || "Unknown file type"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">File size</p>
                  <p className="mt-1 text-sm font-medium">
                    {sizeFmt(data.file.size)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Views recorded</p>
                  <p className="mt-1 text-sm font-medium">
                    {data.file.accessCount}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Last accessed</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(data.file.lastAccessedAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Created</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(data.file.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Last modified</p>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(data.file.updatedAt)}
                  </p>
                </div>
              </div>
            </section>

            {/* OWNER */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <User size={17} />
                File owner
              </h3>

              <div className="rounded-xl border border-slate-200 p-3">
                {data.owner ? (
                  <>
                    <p className="text-sm font-semibold">{data.owner.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {data.owner.email}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Owner information unavailable.
                  </p>
                )}
              </div>
            </section>

            {/* ACCESS STATUS */}
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck size={17} />
                General access
              </h3>

              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <Lock size={19} className="text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {data.access.isPrivate ? "Private" : "Restricted access"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {data.access.isPrivate
                        ? "No additional sharing permissions are configured."
                        : "Access is controlled by the permissions below."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <Users size={19} className="text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Organisation access</p>
                    <p className="text-xs text-slate-500">
                      {data.access.organisation.label}
                    </p>
                  </div>
                  <span className="text-xs font-semibold capitalize">
                    {data.access.organisation.role}
                  </span>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <Link2 size={19} className="text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Anyone with the link</p>
                    <p className="text-xs text-slate-500">
                      {data.access.link.enabled
                        ? `Active · ${data.access.link.role === "edit" ? "Editor" : "Viewer"}`
                        : "No active public link"}
                    </p>

                    {data.access.link.enabled && (
                      <p className="mt-1 text-xs text-slate-400">
                        Expires:{" "}
                        {data.access.link.expiresAt
                          ? formatDate(data.access.link.expiresAt)
                          : "Never"}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      data.access.link.enabled
                        ? "text-xs font-semibold text-green-600"
                        : "text-xs text-slate-400"
                    }
                  >
                    {data.access.link.enabled ? "Active" : "Off"}
                  </span>
                </div>
              </div>
            </section>

            {/* INDIVIDUAL ACCESS */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                People with access ({data.access.people.length})
              </h3>

              {data.access.people.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                  No individually shared employees.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {data.access.people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 p-3"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                        {person.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {person.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {person.email}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-semibold capitalize">
                          {person.role === "edit" ? "Editor" : "Viewer"}
                        </p>
                        <p
                          className={
                            person.active
                              ? "text-xs text-green-600"
                              : "text-xs text-red-500"
                          }
                        >
                          {person.active ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ACTIVITY HISTORY */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock size={17} />
                  Recent activity
                </h3>

                <button
                  onClick={loadInfo}
                  title="Refresh activity"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <RefreshCw size={15} />
                </button>
              </div>

              {data.activity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
                  No activity recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.activity.map((activity) => {
                    const Icon = actionIcons[activity.action] || Clock;

                    return (
                      <div key={activity.id} className="flex gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                          <Icon size={16} />
                        </div>

                        <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
                          <p className="text-sm font-medium text-slate-800">
                            {formatAction(activity.action)}
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            {activity.actorName}
                          </p>

                          {activity.actorEmail && (
                            <p className="text-xs text-slate-400">
                              {activity.actorEmail}
                            </p>
                          )}

                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(activity.createdAt)}
                          </p>

                          <p className="mt-1 text-xs capitalize text-slate-400">
                            Via {activity.accessMethod || "unknown"}
                          </p>

                          {activity.details && (
                            <p className="mt-1 text-xs text-slate-500">
                              {activity.details}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
