"use client";

import { useEffect, useState } from "react";
import {
  HardDrive,
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Database,
  RefreshCw,
  User,
  Clock,
  Server,
} from "lucide-react";
import { api } from "@/lib/client";

type StorageFile = {
  id: string;
  name: string;
  type: "file" | "folder";
  mime: string;
  size: number;
  uploaded: number;
  trashed: boolean;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type Category = {
  _id: string | null;
  count: number;
  size: number;
};

type StorageData = {
  storage: {
    usedBytes: number;
    reservedBytes: number;
    quotaBytes: number;
    totalFiles: number;
    storedFiles: number;
    remainingBytes: number;
    storageLocation: string;
    directory: string;
  };
  categories: Category[];
  items: StorageFile[];
};

type ConnectionData = {
  connected: boolean;
  message: string;
};

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index >= 2 ? 2 : 1)} ${units[index]}`;
}

function formatDate(date: string) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryName(mime: string) {
  if (!mime) return "Other files";
  if (mime.startsWith("image/")) return "Images";
  if (mime.startsWith("video/")) return "Videos";
  if (mime.startsWith("audio/")) return "Audio";
  if (mime === "application/pdf") return "PDF documents";

  if (
    mime.includes("document") ||
    mime.includes("word") ||
    mime.includes("text/")
  ) {
    return "Documents";
  }

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  ) {
    return "Spreadsheets";
  }

  return "Other files";
}

export default function AdminStoragePage() {
  const [data, setData] = useState<StorageData | null>(null);
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStorage() {
    setLoading(true);
    setError("");

    // Load storage data independently from connection status.
    try {
      const result = await api("/api/admin/storage");
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load storage information.",
      );
    }

    // A connection failure should not hide the dashboard.
    try {
      const result = await api("/api/admin/storage/connection");
      setConnection(result);
    } catch (err) {
      setConnection({
        connected: false,
        message:
          err instanceof Error
            ? err.message
            : "Unable to connect to VPS storage.",
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadStorage();
  }, []);

  const storage = data?.storage;

  const usagePercent = storage?.quotaBytes
    ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100)
    : 0;

  const categories = [
    {
      name: "Documents",
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      name: "Images",
      icon: ImageIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      name: "Videos",
      icon: Video,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      name: "Other files",
      icon: Folder,
      color: "text-slate-600",
      bg: "bg-slate-100",
    },
  ];

  function categoryStats(name: string) {
    const matching = (data?.categories || []).filter(
      (item) => categoryName(item._id || "") === name,
    );

    return {
      count: matching.reduce((sum, item) => sum + item.count, 0),
      size: matching.reduce((sum, item) => sum + item.size, 0),
    };
  }

  return (
    <div className="space-y-7">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            <span>Admin Console</span>
            <span>/</span>
            <span className="text-slate-900">Storage</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Storage
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor VPS storage usage and workspace files.
          </p>
        </div>

        <button
          onClick={loadStorage}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}

          <button
            onClick={loadStorage}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading storage information...
        </div>
      ) : data && storage ? (
        <>
          {/* VPS connection */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                  <Server size={23} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    Hostinger VPS Connection
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {connection?.message || "Checking connection..."}
                  </p>
                </div>
              </div>

              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-medium ${
                  connection?.connected
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {connection?.connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Storage location</p>
                <p className="mt-1 font-medium text-slate-700">
                  {storage.storageLocation || "Hostinger VPS"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Storage directory</p>
                <p className="mt-1 break-all font-medium text-slate-700">
                  {storage.directory}
                </p>
              </div>
            </div>
          </section>

          {/* Main storage usage */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                  <HardDrive size={26} />
                </div>

                <div>
                  <h2 className="font-semibold text-slate-900">
                    VPS Workspace Storage
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Actual files stored on Hostinger
                  </p>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-2xl font-semibold text-slate-900">
                  {formatBytes(storage.usedBytes)}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  of {formatBytes(storage.quotaBytes)} quota used
                </p>
              </div>
            </div>

            <div className="mt-7">
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>

              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>{usagePercent.toFixed(1)}% used</span>
                <span>{formatBytes(storage.remainingBytes)} remaining</span>
              </div>
            </div>
          </section>

          {/* Storage statistics */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 text-slate-500">
                <Database size={19} />
                <span className="text-sm">Actual uploaded data</span>
              </div>

              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatBytes(storage.usedBytes)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 text-slate-500">
                <HardDrive size={19} />
                <span className="text-sm">Reserved file size</span>
              </div>

              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatBytes(storage.reservedBytes)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 text-slate-500">
                <FileText size={19} />
                <span className="text-sm">Files on VPS</span>
              </div>

              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {storage.storedFiles}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3 text-slate-500">
                <Database size={19} />
                <span className="text-sm">Available quota</span>
              </div>

              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatBytes(storage.remainingBytes)}
              </p>
            </div>
          </section>

          {/* Storage categories */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Storage categories
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Breakdown based on file MIME types.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => {
                const Icon = category.icon;
                const stats = categoryStats(category.name);

                return (
                  <div
                    key={category.name}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div
                      className={`inline-flex rounded-xl p-3 ${category.bg} ${category.color}`}
                    >
                      <Icon size={21} />
                    </div>

                    <h3 className="mt-4 font-medium text-slate-900">
                      {category.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      {stats.count} files
                    </p>

                    <p className="mt-2 text-lg font-semibold text-slate-800">
                      {formatBytes(stats.size)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* File activity */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-900">File activity</h2>

              <p className="mt-1 text-sm text-slate-500">
                Latest files and folders, including their creators.
              </p>
            </div>

            {!data.items.length ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No files or folders found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">Created by</th>
                      <th className="px-5 py-3 font-medium">Size</th>
                      <th className="px-5 py-3 font-medium">Created date</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {item.type === "folder" ? (
                              <Folder
                                size={19}
                                className="shrink-0 text-amber-500"
                              />
                            ) : (
                              <FileText
                                size={19}
                                className="shrink-0 text-blue-500"
                              />
                            )}

                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate font-medium text-slate-800">
                                {item.name}
                              </p>

                              <p className="text-xs text-slate-400">
                                {item.type === "folder"
                                  ? "Folder"
                                  : item.mime || "File"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {item.createdBy ? (
                            <div className="flex items-center gap-2">
                              <User
                                size={16}
                                className="shrink-0 text-slate-400"
                              />

                              <div>
                                <p className="font-medium text-slate-800">
                                  {item.createdBy.name}
                                </p>

                                <p className="text-xs text-slate-400">
                                  {item.createdBy.email}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Unknown user</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {item.type === "folder"
                            ? "—"
                            : formatBytes(item.uploaded)}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Clock size={15} className="text-slate-400" />
                            {formatDate(item.createdAt)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {item.trashed ? (
                            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                              Trashed
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Showing up to 200 most recently created items.
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
