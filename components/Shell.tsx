"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  LayoutDashboard,
  HardDrive,
  FileText,
  Table2,
  CalendarDays,
  Video,
  MessageCircle,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Settings,
} from "lucide-react";

import AdminShell from "./AdminShell";
import NotificationBell from "./NotificationBell";
import { NotificationsProvider, useNotifications } from "./NotificationsContext";
import { UserProvider } from "./UserContext";

/* ==========================================================================
   2. NAVIGATION
   ========================================================================== */
const NAV = [
  {
    group: "Workspace",
    items: [
      { name: "Overview", href: "/home", icon: LayoutDashboard },
      { name: "Drive", href: "/drive", icon: HardDrive },
      { name: "Docs", href: "/docs", icon: FileText },
      { name: "Sheets", href: "/sheets", icon: Table2 },
    ],
  },
  {
    group: "Collaborate",
    items: [
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Meet", href: "/meet", icon: Video },
      { name: "Chat", href: "/chat", icon: MessageCircle },
    ],
  },
];

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/* ==========================================================================
   3. SIDEBAR
   ========================================================================== */
function Sidebar({
  pathname,
  admin,
  onNavigate,
}: {
  pathname: string;
  admin: boolean;
  onNavigate: () => void;
}) {
  const { chatUnread } = useNotifications();

  const link = (href: string, name: string, Icon: any, badge = 0) => {
    const active = isActive(pathname, href);

    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          active
            ? "bg-purple-50 text-purple-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.2 : 1.9} />
        <span className="flex-1">{name}</span>
        {badge > 0 && <span className="badge">{badge > 99 ? "99+" : badge}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <Link href="/home" onClick={onNavigate} className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line px-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-lg font-bold text-white">E</span>
        <span>
          <span className="block text-[15px] font-bold leading-tight text-slate-900">EduOne</span>
          <span className="block text-[11px] leading-tight text-slate-500">Workspace</span>
        </span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.group}
            </p>
            <div className="space-y-1">
              {section.items.map((item) =>
                link(item.href, item.name, item.icon, item.href === "/chat" ? chatUnread : 0),
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="space-y-1 border-t border-line px-3 py-4">
        {link("/settings", "Settings", Settings)}
        {admin && link("/admin", "Admin console", ShieldCheck)}
      </div>
    </div>
  );
}

/* ==========================================================================
   4. SHELL
   ========================================================================== */
function ShellContent({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const current =
    [...NAV.flatMap((s) => s.items), { name: "Settings", href: "/settings" }].find((i) =>
      isActive(pathname, i.href),
    )?.name || "Workspace";

  return (
    <div className="min-h-screen bg-page text-slate-900 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Mobile overlay */}
      {drawerOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[248px] border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          className="absolute right-3 top-5 rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
        <Sidebar pathname={pathname} admin={admin} onNavigate={() => setDrawerOpen(false)} />
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-line bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={21} />
            </button>
            <h1 className="text-base font-semibold text-slate-900">{current}</h1>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-slate-100"
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                  {user.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-800">{user.name}</span>
                  <span className="block text-[11px] leading-tight text-slate-500">
                    {admin ? "Administrator" : "Member"}
                  </span>
                </span>
                <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
              </button>

              {profileOpen && (
                <>
                  <button
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close account menu"
                    onClick={() => setProfileOpen(false)}
                  />

                  <div className="absolute right-0 top-12 z-50 w-60 rounded-xl border border-line bg-white p-2 shadow-lg">
                    <div className="mb-2 border-b border-slate-100 px-3 pb-3 pt-2">
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">eduoneinternational.com</p>
                    </div>

                    {admin && (
                      <Link
                        href="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <ShieldCheck size={17} />
                        Admin console
                      </Link>
                    )}

                    <Link
                      href="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings size={17} />
                      Settings
                    </Link>

                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={17} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1600px] p-5 sm:p-8 lg:p-10">
          <UserProvider user={user}>{children}</UserProvider>
        </main>
      </div>
    </div>
  );
}

export default function Shell({
  user,
  children,
}: {
  user: { name: string; role: string };
  children: React.ReactNode;
}) {
  return (
    <NotificationsProvider>
      <ShellContent user={user}>{children}</ShellContent>
    </NotificationsProvider>
  );
}
