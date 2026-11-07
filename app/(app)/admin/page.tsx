"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import {
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  ArrowUpRight,
  Plus,
  RefreshCw,
  HardDrive,
  Grid3X3,
  Activity,
} from "lucide-react";

type User = {
  _id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt?: string;
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setError("");
      const data = await api("/api/admin/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const active = users.filter((u) => u.active).length;
  const disabled = users.filter((u) => !u.active).length;
  const admins = users.filter((u) => u.role === "admin").length;

  const stats = [
    {
      label: "Total users",
      value: users.length,
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active users",
      value: active,
      icon: UserCheck,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Disabled users",
      value: disabled,
      icon: UserX,
      color: "bg-orange-50 text-orange-600",
    },
    {
      label: "Administrators",
      value: admins,
      icon: ShieldCheck,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm font-medium text-blue-600">
            EDUONE INTERNATIONAL
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Admin overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage your organization's workspace from one place.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={17} />
            Add user
          </Link>
        </div>
      </div>

      {/* Statistics */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-800">
            User overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Current account statistics from your workspace.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-xl ${stat.color}`}
                  >
                    <Icon size={21} />
                  </div>
                  <ArrowUpRight size={17} className="text-slate-300" />
                </div>

                <p className="mt-5 text-sm text-slate-500">{stat.label}</p>

                <h3 className="mt-1 text-3xl font-semibold text-slate-900">
                  {loading ? "—" : stat.value}
                </h3>
              </div>
            );
          })}
        </div>
      </section>

      {/* Management shortcuts */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-slate-800">
          Workspace management
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Users",
              description: "Create accounts and manage employee access.",
              href: "/admin/users",
              icon: Users,
              color: "text-blue-600 bg-blue-50",
            },
            {
              title: "Apps",
              description: "Manage workspace applications and services.",
              href: "/admin/apps",
              icon: Grid3X3,
              color: "text-purple-600 bg-purple-50",
            },
            {
              title: "Storage",
              description: "Monitor company file storage and usage.",
              href: "/admin/storage",
              icon: HardDrive,
              color: "text-green-600 bg-green-50",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
              >
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${item.color}`}
                >
                  <Icon size={21} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>

                <ArrowUpRight
                  size={17}
                  className="text-slate-300 transition group-hover:text-blue-600"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent users */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Workspace users</h2>
            <p className="mt-1 text-xs text-slate-500">
              Recently created accounts
            </p>
          </div>

          <Link
            href="/admin/users"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No users found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {[...users]
              .sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime(),
              )
              .slice(0, 5)
              .map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-3 px-5 py-4"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                    {user.name?.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>

                  <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:block">
                    {user.role}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      user.active
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {user.active ? "Active" : "Disabled"}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Activity size={14} />
        EduOne Workspace Administration
      </div>
    </div>
  );
}
