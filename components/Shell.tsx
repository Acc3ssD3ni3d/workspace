"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  HardDrive,
  FileText,
  Table2,
  CalendarDays,
  Video,
  MessageCircle,
  ShieldCheck,
  Grid3X3,
  LogOut,
  ChevronDown,
  X,
  Settings,
} from "lucide-react";

import AdminShell from "./AdminShell";
import { UserProvider } from "./UserContext";

const APPS = [
  {
    name: "Drive",
    description: "Files and storage",
    href: "/drive",
    icon: HardDrive,
    color: "bg-blue-50 text-blue-600",
  },
  {
    name: "Docs",
    description: "Documents",
    href: "/docs",
    icon: FileText,
    color: "bg-sky-50 text-sky-600",
  },
  {
    name: "Sheets",
    description: "Spreadsheets",
    href: "/sheets",
    icon: Table2,
    color: "bg-green-50 text-green-600",
  },
  {
    name: "Calendar",
    description: "Events and schedules",
    href: "/calendar",
    icon: CalendarDays,
    color: "bg-orange-50 text-orange-600",
  },
  {
    name: "Meet",
    description: "Video meetings",
    href: "/meet",
    icon: Video,
    color: "bg-red-50 text-red-600",
  },
  {
    name: "Chat",
    description: "Team communication",
    href: "/chat",
    icon: MessageCircle,
    color: "bg-purple-50 text-purple-600",
  },
  {
    name: "Settings",
    description: "Account and integrations",
    href: "/settings",
    icon: Settings,
    color: "bg-slate-100 text-slate-700",
  },
];

export default function Shell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [launcherOpen, setLauncherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const admin = user.role === "admin";

  if (admin && pathname.startsWith("/admin")) {
    return <AdminShell user={user}>{children}</AdminShell>;
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            E
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              EduOne Workspace
            </h1>
            <p className="text-xs text-slate-500">eduoneinternational.com</p>
          </div>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* App Launcher */}
          <div className="relative">
            <button
              onClick={() => {
                setLauncherOpen(!launcherOpen);
                setProfileOpen(false);
              }}
              aria-label="Open applications"
              aria-expanded={launcherOpen}
              className={`grid h-11 w-11 place-items-center rounded-full transition ${
                launcherOpen
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Grid3X3 size={23} strokeWidth={1.8} />
            </button>

            {launcherOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close applications"
                  onClick={() => setLauncherOpen(false)}
                />

                <div className="absolute right-0 top-14 z-50 w-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:w-[370px]">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Your applications
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Everything you need for work
                      </p>
                    </div>

                    <button
                      onClick={() => setLauncherOpen(false)}
                      className="rounded-full p-2 text-slate-400 hover:bg-slate-100"
                      aria-label="Close launcher"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {APPS.map((app) => {
                      const Icon = app.icon;
                      const active =
                        pathname === app.href ||
                        pathname.startsWith(`${app.href}/`);

                      return (
                        <Link
                          key={app.href}
                          href={app.href}
                          onClick={() => setLauncherOpen(false)}
                          className={`flex flex-col items-center rounded-xl p-3 text-center transition hover:bg-slate-50 ${
                            active ? "bg-blue-50" : ""
                          }`}
                        >
                          <div
                            className={`mb-2 grid h-12 w-12 place-items-center rounded-2xl ${app.color}`}
                          >
                            <Icon size={24} strokeWidth={1.8} />
                          </div>

                          <span className="text-sm font-semibold text-slate-800">
                            {app.name}
                          </span>

                          <span className="mt-1 text-[10px] text-slate-400">
                            {app.description}
                          </span>
                        </Link>
                      );
                    })}

                    {admin && (
                      <Link
                        href="/admin"
                        onClick={() => setLauncherOpen(false)}
                        className="flex flex-col items-center rounded-xl p-3 text-center transition hover:bg-slate-50"
                      >
                        <div className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                          <ShieldCheck size={24} />
                        </div>

                        <span className="text-sm font-semibold text-slate-800">
                          Admin
                        </span>

                        <span className="mt-1 text-[10px] text-slate-400">
                          Manage workspace
                        </span>
                      </Link>
                    )}
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4 text-center">
                    <p className="text-xs text-slate-400">EduOne Workspace</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen(!profileOpen);
                setLauncherOpen(false);
              }}
              className="flex items-center gap-2 rounded-full p-1.5 transition hover:bg-slate-100"
              aria-label="Account menu"
              aria-expanded={profileOpen}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {user.name.slice(0, 2).toUpperCase()}
              </span>

              <ChevronDown
                size={16}
                className="hidden text-slate-500 sm:block"
              />
            </button>

            {profileOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close account menu"
                  onClick={() => setProfileOpen(false)}
                />

                <div className="absolute right-0 top-14 z-50 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-4 border-b border-slate-100 pb-4">
                    <p className="font-semibold text-slate-900">{user.name}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      {admin ? "Administrator" : "Workspace Member"}
                    </p>

                    <p className="mt-1 break-all text-xs text-slate-400">
                      eduoneinternational.com
                    </p>
                  </div>

                  {admin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <ShieldCheck size={18} />
                      Admin Console
                    </Link>
                  )}

                  <Link
                    href="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Settings size={18} />
                    Settings
                  </Link>

                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={18} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Application Content */}
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1600px] p-5 sm:p-8 lg:p-10">
        <UserProvider user={user}>{children}</UserProvider>
      </main>
    </div>
  );
}
