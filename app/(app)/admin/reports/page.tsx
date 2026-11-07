"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  HardDrive,
  Database,
  FileText,
  CalendarDays,
  MessageSquare,
  AppWindow,
  RefreshCw,
  TrendingUp,
  Server,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/client";

type ReportsData = {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    members: number;
    newUsers: number;
  };
  storage: {
    connected: boolean;
    usedBytes: number;
    storedFiles: number;
    databaseFiles: number;
    uploadedBytes: number;
    reservedBytes: number;
  };
  applications: {
    total: number;
    enabled: number;
    disabled: number;
    apps: Record<string, boolean>;
  };
  workspace: {
    documents: number;
    spreadsheets: number;
    calendarEvents: number;
    chatMessages: number;
  };
  activity: {
    date: string;
    count: number;
  }[];
};

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReports(selectedDays = days) {
    setLoading(true);
    setError("");

    try {
      const result = await api(`/api/admin/reports?days=${selectedDays}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports(days);
  }, [days]);

  const maxActivity = Math.max(
    1,
    ...(data?.activity.map((item) => item.count) || []),
  );

  const appNames: Record<string, string> = {
    drive: "Drive",
    docs: "Docs",
    sheets: "Sheets",
    calendar: "Calendar",
    meet: "Meet",
    chat: "Chat",
    email: "Email",
  };

  const workspaceStats = [
    {
      title: "Documents",
      value: data?.workspace.documents || 0,
      icon: FileText,
    },
    {
      title: "Spreadsheets",
      value: data?.workspace.spreadsheets || 0,
      icon: FileSpreadsheet,
    },
    {
      title: "Calendar events",
      value: data?.workspace.calendarEvents || 0,
      icon: CalendarDays,
    },
    {
      title: "Chat messages",
      value: data?.workspace.chatMessages || 0,
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-7">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Admin Console</span>
            <span>/</span>
            <span className="text-slate-900">Reports</span>
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Reports & Analytics
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor users, applications, storage and workspace activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            onClick={() => loadReports()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={() => loadReports()}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading reports...
        </div>
      ) : data ? (
        <>
          {/* User overview */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  User overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current workspace account statistics.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Total users",
                  value: data.users.total,
                  icon: Users,
                },
                {
                  title: "Active users",
                  value: data.users.active,
                  icon: UserCheck,
                },
                {
                  title: "Inactive users",
                  value: data.users.inactive,
                  icon: UserX,
                },
                {
                  title: "New users",
                  value: data.users.newUsers,
                  icon: TrendingUp,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">{item.title}</p>
                      <Icon size={20} className="text-slate-400" />
                    </div>

                    <p className="mt-4 text-3xl font-semibold text-slate-900">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Account breakdown */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-900">
                Account breakdown
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Distribution of workspace accounts.
              </p>

              <div className="mt-6 space-y-5">
                {[
                  {
                    label: "Administrators",
                    value: data.users.admins,
                    color: "bg-blue-600",
                  },
                  {
                    label: "Members",
                    value: data.users.members,
                    color: "bg-violet-500",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-slate-600">{item.label}</span>
                      <span className="font-semibold text-slate-900">
                        {item.value}
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{
                          width: `${
                            data.users.total
                              ? (item.value / data.users.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Storage */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">VPS storage</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Actual Workspace files on Hostinger.
                  </p>
                </div>

                <HardDrive size={23} className="text-slate-400" />
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    data.storage.connected ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-slate-600">
                  {data.storage.connected
                    ? "VPS connected"
                    : "VPS disconnected"}
                </span>
              </div>

              <p className="mt-5 text-3xl font-semibold text-slate-900">
                {formatBytes(data.storage.usedBytes)}
              </p>

              <p className="mt-1 text-sm text-slate-500">Actual stored data</p>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-xs text-slate-400">Files on VPS</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {data.storage.storedFiles}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Database files</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {data.storage.databaseFiles}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Applications */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Workspace applications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Application availability controlled by the administrator.
                </p>
              </div>

              <div className="flex gap-5 text-sm">
                <span className="text-green-700">
                  {data.applications.enabled} Enabled
                </span>
                <span className="text-red-600">
                  {data.applications.disabled} Disabled
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(data.applications.apps).map(([key, enabled]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex items-center gap-3">
                    <AppWindow size={19} className="text-slate-400" />
                    <span className="text-sm font-medium capitalize text-slate-700">
                      {appNames[key] || key}
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      enabled
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Workspace activity */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Workspace activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Existing records across workspace applications.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {workspaceStats.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">{item.title}</p>
                      <Icon size={20} className="text-slate-400" />
                    </div>

                    <p className="mt-4 text-3xl font-semibold text-slate-900">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Activity chart */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h2 className="font-semibold text-slate-900">Activity trend</h2>
              <p className="mt-1 text-sm text-slate-500">
                Newly created database records over the selected period.
              </p>
            </div>

            {data.activity.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No activity recorded during this period.
              </div>
            ) : (
              <div className="mt-8">
                <div className="flex h-48 items-end gap-2 overflow-x-auto border-b border-slate-100 pb-2">
                  {data.activity.map((item) => (
                    <div
                      key={item.date}
                      className="flex h-full min-w-7 flex-1 flex-col items-center justify-end gap-2"
                      title={`${item.date}: ${item.count} records`}
                    >
                      <span className="text-[10px] text-slate-500">
                        {item.count}
                      </span>

                      <div
                        className="w-full max-w-10 rounded-t-md bg-blue-500 transition-all"
                        style={{
                          height: `${Math.max(
                            4,
                            (item.count / maxActivity) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                  <span>{formatDate(data.activity[0].date)}</span>
                  <span>
                    {formatDate(data.activity[data.activity.length - 1].date)}
                  </span>
                </div>

                <p className="mt-5 text-sm text-slate-500">
                  Total recorded activity:{" "}
                  <strong className="text-slate-900">
                    {data.activity.reduce((sum, item) => sum + item.count, 0)}
                  </strong>
                </p>
              </div>
            )}
          </section>

          {/* Account summary */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <ShieldCheck size={21} className="text-slate-500" />
              <div>
                <h3 className="font-semibold text-slate-900">
                  Reporting information
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Current account totals and application records are combined
                  with activity from the selected period. Login history and task
                  completion are not tracked yet.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
