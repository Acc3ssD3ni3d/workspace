"use client";

/* ==========================================================================
   1. IMPORTS
   ========================================================================== */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  HardDrive,
  FileText,
  Table2,
  CalendarDays,
  Video,
  MessageCircle,
  ShieldCheck,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Users,
  LogOut,
  Grid3X3,
  ChevronDown,
  X,
  Settings,
} from "lucide-react";
import { api } from "@/lib/client";
import { useUser } from "@/components/UserContext";

/* ==========================================================================
   2. TYPES
   ========================================================================== */
type WorkspaceEvent = {
  _id: string;
  title: string;
  desc?: string;
  start: string;
  end?: string;
  room?: string;
  createdBy?: string;
};

type RecentDocument = {
  _id: string;
  title: string;
  updatedAt: string;
  googleWebViewLink?: string;
  backupStatus?: string;
};

/* ==========================================================================
   3. STATIC DATA
   ========================================================================== */
const apps: {
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    name: "Drive",
    description: "Files and folders",
    href: "/drive",
    icon: HardDrive,
  },
  {
    name: "Docs",
    description: "Shared documents",
    href: "/docs",
    icon: FileText,
  },
  {
    name: "Sheets",
    description: "Spreadsheets",
    href: "/sheets",
    icon: Table2,
  },
  {
    name: "Calendar",
    description: "Team schedules",
    href: "/calendar",
    icon: CalendarDays,
  },
  { name: "Meet", description: "Video meetings", href: "/meet", icon: Video },
  {
    name: "Chat",
    description: "Team messages",
    href: "/chat",
    icon: MessageCircle,
  },
];

/* Launcher apps for the 9-dot menu (Navbar) */
const LAUNCHER_APPS = [
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

const statStyle = {
  card: "bg-blue-600 border-blue-500 shadow-[0_10px_24px_-12px_rgb(37_99_235/0.7)]",
  iconBox: "bg-white/15 text-white",
  label: "text-blue-100",
  value: "text-white",
  arrow: "text-blue-200",
};

/* ==========================================================================
   4. HELPERS
   ========================================================================== */
const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

/* ==========================================================================
   5. COUNTDOWN
   ========================================================================== */
function Countdown({ target }: { target: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      setRemaining(Math.max(0, new Date(target).getTime() - Date.now()));
    };

    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [target]);

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const units = [
    { label: "Days", value: days },
    { label: "Hrs", value: hours },
    { label: "Min", value: minutes },
    { label: "Sec", value: seconds },
  ];

  return (
    <div className="grid grid-cols-4 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.05]">
      {units.map((unit) => (
        <div key={unit.label} className="px-2 py-3 text-center">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-white">
            {String(unit.value).padStart(2, "0")}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-blue-300/80">
            {unit.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   6. MINI CALENDAR
   ========================================================================== */
function MiniCalendar({
  currentMonth,
  setCurrentMonth,
  selectedDate,
  setSelectedDate,
  eventDates,
  now,
}: {
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  selectedDate: number | null;
  setSelectedDate: (date: number | null) => void;
  eventDates: Set<number>;
  now: Date;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [
    ...Array.from({ length: firstDay }, () => 0),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const changeMonth = (amount: number) => {
    setCurrentMonth(new Date(year, month + amount, 1));
    setSelectedDate(null);
  };

  const navButton =
    "grid h-8 w-8 place-items-center rounded-lg border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-100 " +
    focusRing;

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-[0_10px_24px_-16px_rgb(30_64_175/0.35)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-950">
          {currentMonth.toLocaleDateString("en-IN", {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className={navButton}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className={navButton}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <div
            key={`${day}-${index}`}
            className="pb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-blue-400"
          >
            {day}
          </div>
        ))}

        {days.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;

          const isToday =
            day === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();

          const isSelected = selectedDate === day;
          const hasEvent = eventDates.has(day);

          const dayStyle = isSelected
            ? "bg-blue-200 font-semibold text-blue-700 ring-2 ring-inset ring-blue-500"
            : isToday
              ? "bg-blue-600 font-semibold text-white"
              : hasEvent
                ? "bg-white font-semibold text-blue-700 ring-1 ring-inset ring-blue-500"
                : "text-slate-700 hover:bg-white";

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDate(isSelected ? null : day)}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-[13px] font-medium tabular-nums transition ${focusRing} ${dayStyle}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-blue-200 pt-3">
        <div className="flex items-center gap-3.5 text-[11px] font-medium text-blue-800">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-inset ring-blue-500" />
            Events
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(null)}
          className="text-[11px] font-medium text-blue-500 transition hover:text-blue-800"
        >
          Clear
        </button>
      </div>
    </section>
  );
}

/* ==========================================================================
   7. STAT CARD (KPI)
   ========================================================================== */
function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-4 rounded-2xl border p-5 ${statStyle.card} ${focusRing}`}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${statStyle.iconBox}`}
        >
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className={`truncate text-xs font-medium ${statStyle.label}`}>
            {label}
          </p>
          <p
            className={`mt-0.5 text-3xl font-semibold tabular-nums tracking-tight ${statStyle.value}`}
          >
            {value}
          </p>
        </div>
      </div>
      <ArrowUpRight size={17} className={`shrink-0 ${statStyle.arrow}`} />
    </Link>
  );
}

/* ==========================================================================
   8. PAGE (Combined Shell + Overview)
   ========================================================================== */
export default function WorkspaceOverview() {
  const pathname = usePathname();
  const router = useRouter();

  /* ---------- User / Auth ---------- */
  const user = useUser();
  const isAdmin =
    String(user?.role ?? "")
      .trim()
      .toLowerCase() === "admin";
  const userName = user?.name || "User";

  /* ---------- Navbar State ---------- */
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  /* ---------- Overview State ---------- */
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [documents, setDocuments] = useState<RecentDocument[]>([]);
  const [sheets, setSheets] = useState<RecentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventError, setEventError] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  /* ---------- Live clock ---------- */
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  /* ---------- Logout Logic ---------- */
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  /* ---------- Data loading ---------- */
  useEffect(() => {
    let active = true;

    async function loadOverview() {
      try {
        const results = await Promise.allSettled([
          api("/api/events"),
          api("/api/docs?kind=doc"),
          api("/api/docs?kind=sheet"),
        ]);

        if (!active) return;

        if (results[0].status === "fulfilled") {
          setEvents(Array.isArray(results[0].value) ? results[0].value : []);
        } else {
          setEventError("Unable to load calendar events.");
        }

        if (results[1].status === "fulfilled") {
          setDocuments(
            Array.isArray(results[1].value) ? results[1].value.slice(0, 5) : [],
          );
        }

        if (results[2].status === "fulfilled") {
          setSheets(
            Array.isArray(results[2].value) ? results[2].value.slice(0, 5) : [],
          );
        }
      } catch {
        if (active) setEventError("Unable to load workspace overview.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOverview();

    return () => {
      active = false;
    };
  }, []);

  /* ---------- Derived data ---------- */
  const upcomingEvents = useMemo(
    () =>
      events
        .filter(
          (event) =>
            new Date(event.end || event.start).getTime() >= now.getTime(),
        )
        .sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        ),
    [events, now],
  );

  const nextEvent = upcomingEvents[0];

  const eventDates = useMemo(
    () =>
      new Set(
        events
          .filter((event) => {
            const date = new Date(event.start);
            return (
              date.getFullYear() === currentMonth.getFullYear() &&
              date.getMonth() === currentMonth.getMonth()
            );
          })
          .map((event) => new Date(event.start).getDate()),
      ),
    [events, currentMonth],
  );

  const selectedEvents = selectedDate
    ? events.filter((event) => {
        const date = new Date(event.start);
        return (
          date.getFullYear() === currentMonth.getFullYear() &&
          date.getMonth() === currentMonth.getMonth() &&
          date.getDate() === selectedDate
        );
      })
    : [];

  const recentFiles = [...documents, ...sheets]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 6);

  /* ---------- Render ---------- */
  return (
    <div className="min-h-screen bg-page text-slate-900">
      {/* ==============================
          TOP NAVIGATION (SHELL NAVBAR)
          ============================== */}
   

      {/* ==============================
          PAGE CONTENT (OVERVIEW)
          ============================== */}
      <main className="mx-auto min-h-[calc(100vh-72px)] w-full max-w-[1400px] space-y-6 px-4 py-8 pb-12 sm:px-6 lg:px-8">
        {/* ---------- Page Header ---------- */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
              EduOne International
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-blue-950">
              Workspace overview
            </h1>

            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Files, events and meetings for your team, in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
              <Clock3 size={15} className="text-blue-600" />

              <div className="leading-tight">
                <p className="text-sm font-semibold tabular-nums text-blue-950">
                  {now.toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>

                <p className="text-[11px] text-blue-700/80">
                  {now.toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
            </div>

            {/* Admin shortcut in page header (Optional, but kept as requested) */}
            {isAdmin && (
              <Link
                href="/admin"
                className={`inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 ${focusRing}`}
              >
                <ShieldCheck size={17} />
                Admin
              </Link>
            )}

            {/* REMOVED LOGOUT BUTTON FROM HERE */}
          </div>
        </header>

        {/* ---------- KPI cards ---------- */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={CalendarDays}
            label="Upcoming events"
            value={String(upcomingEvents.length).padStart(2, "0")}
            href="/calendar"
          />
          <StatCard
            icon={FileText}
            label="Recent documents"
            value={String(documents.length).padStart(2, "0")}
            href="/docs"
          />
          <StatCard
            icon={Table2}
            label="Active spreadsheets"
            value={String(sheets.length).padStart(2, "0")}
            href="/sheets"
          />
        </section>

        {/* ---------- Main grid ---------- */}
        <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold text-blue-950">
                Applications
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {apps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <Link
                      key={app.href}
                      href={app.href}
                      className={`flex items-center gap-3.5 rounded-xl border border-blue-100 bg-white p-4 shadow-[0_8px_20px_-8px_rgb(37_99_235/0.28)] ${focusRing}`}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-600 text-white">
                        <Icon size={18} strokeWidth={1.9} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-blue-950">
                          {app.name}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {app.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}

                {/* Admin app tile in Applications grid */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`flex items-center gap-3.5 rounded-xl border border-indigo-100 bg-white p-4 shadow-[0_8px_20px_-8px_rgb(79_70_229/0.28)] ${focusRing}`}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white">
                      <ShieldCheck size={18} strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-blue-950">
                        Admin
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        Manage workspace
                      </p>
                    </div>
                  </Link>
                )}
              </div>
            </section>

            <section className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-100/80 shadow-[0_10px_24px_-16px_rgb(15_23_42/0.35)]">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold text-blue-950">
                    Recent files
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Pick up where you left off
                  </p>
                </div>
                <Link
                  href="/drive"
                  className={`group inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-blue-700 transition hover:text-blue-900 ${focusRing}`}
                >
                  Open Drive
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              {loading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-lg bg-white/70"
                    />
                  ))}
                </div>
              ) : recentFiles.length > 0 ? (
                <ul className="space-y-2 p-3">
                  {recentFiles.map((file) => {
                    const isSheet = sheets.some(
                      (sheet) => sheet._id === file._id,
                    );

                    return (
                      <li key={file._id}>
                        <a
                          href={
                            file.googleWebViewLink ||
                            (isSheet ? "/sheets" : "/docs")
                          }
                          target={file.googleWebViewLink ? "_blank" : undefined}
                          rel={
                            file.googleWebViewLink
                              ? "noopener noreferrer"
                              : undefined
                          }
                          className={`group flex min-w-0 items-center gap-3.5 rounded-xl border border-white bg-white px-3.5 py-3 transition hover:border-blue-200 ${focusRing}`}
                        >
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
                            {isSheet ? (
                              <Table2 size={16} />
                            ) : (
                              <FileText size={16} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-blue-950">
                              {file.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {isSheet ? "Spreadsheet" : "Document"}
                            </p>
                          </div>

                          <span className="hidden shrink-0 text-xs tabular-nums text-slate-400 sm:block">
                            {formatDate(file.updatedAt)}
                          </span>
                          <ArrowUpRight
                            size={15}
                            className="shrink-0 text-slate-300 transition group-hover:text-blue-600"
                          />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 py-10 text-center">
                  <FileText size={22} className="mb-3 text-blue-300" />
                  <p className="text-sm font-medium text-blue-950">
                    No recent documents
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Files you open or edit will show up here.
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-6 lg:col-span-1">
            <section className="rounded-2xl bg-blue-900 p-6 text-white shadow-[0_14px_30px_-14px_rgb(30_58_138/0.75)] ring-1 ring-inset ring-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                Next up
              </p>

              {nextEvent ? (
                <>
                  <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight">
                    {nextEvent.title}
                  </h2>

                  {nextEvent.desc && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-blue-200/80">
                      {nextEvent.desc}
                    </p>
                  )}

                  <dl className="mt-5 space-y-2.5 border-t border-white/10 pt-4 text-[13px] text-blue-100">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays size={14} className="text-blue-300" />
                      <dd>{formatDate(nextEvent.start)}</dd>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock3 size={14} className="text-blue-300" />
                      <dd>{formatTime(nextEvent.start)}</dd>
                    </div>
                    {nextEvent.createdBy && (
                      <div className="flex items-center gap-2.5">
                        <Users size={14} className="text-blue-300" />
                        <dd>{nextEvent.createdBy}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-6">
                    <Countdown target={nextEvent.start} />
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <CalendarDays
                    size={28}
                    className="mx-auto mb-3 text-blue-300/60"
                  />
                  <h3 className="text-sm font-semibold">No upcoming events</h3>
                  <p className="mt-1 text-sm text-blue-200/80">
                    Your schedule is clear.
                  </p>
                </div>
              )}
            </section>

            <MiniCalendar
              currentMonth={currentMonth}
              setCurrentMonth={setCurrentMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              eventDates={eventDates}
              now={now}
            />

            {selectedDate !== null && (
              <section className="rounded-2xl border border-slate-200 bg-slate-100/80 p-5 shadow-[0_10px_24px_-16px_rgb(15_23_42/0.35)]">
                <h3 className="mb-4 text-sm font-semibold text-blue-950">
                  Events on {selectedDate}{" "}
                  {currentMonth.toLocaleDateString("en-IN", {
                    month: "short",
                  })}
                </h3>

                {selectedEvents.length > 0 ? (
                  <ul className="space-y-3">
                    {selectedEvents.map((event) => (
                      <li
                        key={event._id}
                        className="rounded-lg border-l-2 border-blue-600 bg-white px-3 py-2.5"
                      >
                        <p className="text-sm font-medium text-blue-950">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                          {formatTime(event.start)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    No events scheduled for this date.
                  </p>
                )}
              </section>
            )}

            {eventError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"
              >
                {eventError}
              </p>
            )}
          </aside>
        </section>

        {/* ---------- Admin banner ---------- */}
        {isAdmin && (
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-500 bg-blue-700 p-5 shadow-[0_14px_30px_-14px_rgb(29_78_216/0.7)] sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-950 text-blue-200">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Workspace administration
                </h3>
                <p className="mt-0.5 text-sm text-blue-100">
                  Manage accounts, roles and company data.
                </p>
              </div>
            </div>

            <Link
              href="/admin"
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 ${focusRing}`}
            >
              Admin console
              <ArrowUpRight size={15} />
            </Link>
          </section>
        )}

        <footer className="pt-2 text-center">
          <p className="text-xs text-slate-400">
            EduOne Workspace &copy; {now.getFullYear()}
          </p>
        </footer>
      </main>
    </div>
  );
}
