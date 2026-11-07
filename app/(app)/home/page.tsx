import Link from "next/link";
import {
  HardDrive,
  FileText,
  Table2,
  CalendarDays,
  Video,
  MessageCircle,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

const apps = [
  {
    name: "Drive",
    description: "Store, organize and share your files",
    href: "/drive",
    icon: HardDrive,
    color: "bg-blue-50 text-blue-600",
  },
  {
    name: "Docs",
    description: "Create and collaborate on documents",
    href: "/docs",
    icon: FileText,
    color: "bg-sky-50 text-sky-600",
  },
  {
    name: "Sheets",
    description: "Manage data and spreadsheets",
    href: "/sheets",
    icon: Table2,
    color: "bg-green-50 text-green-600",
  },
  {
    name: "Calendar",
    description: "Manage meetings and schedules",
    href: "/calendar",
    icon: CalendarDays,
    color: "bg-orange-50 text-orange-600",
  },
  {
    name: "Meet",
    description: "Connect with your team through video",
    href: "/meet",
    icon: Video,
    color: "bg-red-50 text-red-600",
  },
  {
    name: "Chat",
    description: "Communicate with your colleagues",
    href: "/chat",
    icon: MessageCircle,
    color: "bg-purple-50 text-purple-600",
  },
];

export default function WorkspaceHome() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Welcome */}
      <div className="mb-10">
        <p className="mb-2 text-sm font-medium text-blue-600">
          EDUONE INTERNATIONAL
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Welcome to your workspace
        </h1>

        <p className="mt-2 text-base text-slate-500">
          Everything you need to work, collaborate and stay connected.
        </p>
      </div>

      {/* Applications */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          Your applications
        </h2>

        <span className="text-sm text-slate-400">Workspace apps</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;

          return (
            <Link
              key={app.href}
              href={app.href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
            >
              <div
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${app.color}`}
              >
                <Icon size={28} strokeWidth={1.8} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">
                    {app.name}
                  </h3>

                  <ArrowUpRight
                    size={18}
                    className="text-slate-300 transition group-hover:text-blue-600"
                  />
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {app.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Admin Console */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={25} />
            </div>

            <div>
              <h3 className="font-semibold text-slate-900">
                Workspace administration
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Manage users, applications and company storage.
              </p>
            </div>
          </div>

          <Link
            href="/admin"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Admin Console
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-slate-200 py-6 text-center">
        <p className="text-xs text-slate-400">
          EduOne Workspace · EduOne International
        </p>
      </div>
    </div>
  );
}
