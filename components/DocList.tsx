"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";

type DocumentItem = {
  _id: string;
  title: string;
  updatedAt: string;
  googleWebViewLink?: string;
  backupStatus?: "not_started" | "pending" | "synced" | "failed";
  backupFormat?: string;
  lastSyncedAt?: string | null;
  googleModifiedTime?: string | null;
  lastSyncError?: string;
};

type TemplateItem = {
  title: string;
  description: string;
  icon: string;
  color: string;
  background: string;
};

export default function DocList({ kind }: { kind: "doc" | "sheet" }) {
  const [list, setList] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");

  const isDoc = kind === "doc";
  const name = isDoc ? "Docs" : "Sheets";

  const templates: TemplateItem[] = isDoc
    ? [
        {
          title: "Blank document",
          description: "Start with a fresh document",
          icon: "＋",
          color: "text-blue-600",
          background: "bg-blue-50",
        },
        {
          title: "Meeting notes",
          description: "Create notes for your next meeting",
          icon: "▤",
          color: "text-purple-600",
          background: "bg-purple-50",
        },
        {
          title: "Project proposal",
          description: "Start a new project proposal",
          icon: "▧",
          color: "text-orange-600",
          background: "bg-orange-50",
        },
        {
          title: "Report",
          description: "Create a professional report",
          icon: "▥",
          color: "text-green-600",
          background: "bg-green-50",
        },
        {
          title: "Letter",
          description: "Start writing a letter",
          icon: "✉",
          color: "text-pink-600",
          background: "bg-pink-50",
        },
      ]
    : [
        {
          title: "Blank spreadsheet",
          description: "Start with an empty spreadsheet",
          icon: "＋",
          color: "text-green-600",
          background: "bg-green-50",
        },
        {
          title: "Project tracker",
          description: "Organize project tasks",
          icon: "▦",
          color: "text-blue-600",
          background: "bg-blue-50",
        },
        {
          title: "Monthly budget",
          description: "Track monthly expenses",
          icon: "₹",
          color: "text-purple-600",
          background: "bg-purple-50",
        },
        {
          title: "Task list",
          description: "Keep track of team tasks",
          icon: "☑",
          color: "text-orange-600",
          background: "bg-orange-50",
        },
        {
          title: "Attendance",
          description: "Organize attendance records",
          icon: "▤",
          color: "text-pink-600",
          background: "bg-pink-50",
        },
      ];

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api(`/api/docs?kind=${kind}`);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load documents.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [kind]);

  const create = async (templateTitle?: string) => {
    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const defaultTitle = isDoc ? "Untitled document" : "Untitled spreadsheet";

      const document = await api("/api/docs", {
        method: "POST",
        body: {
          kind,
          title:
            templateTitle === "Blank document" ||
            templateTitle === "Blank spreadsheet"
              ? defaultTitle
              : templateTitle || defaultTitle,
        },
      });

      await loadDocuments();

      if (document.googleWebViewLink) {
        window.open(
          document.googleWebViewLink,
          "_blank",
          "noopener,noreferrer",
        );
      } else {
        setError("Google file was created, but its link is missing.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create Google file.",
      );
    } finally {
      setCreating(false);
    }
  };

  const openDocument = (item: DocumentItem) => {
    if (!item.googleWebViewLink) return;
    window.open(item.googleWebViewLink, "_blank", "noopener,noreferrer");
  };

  const syncBackup = async (item: DocumentItem) => {
    try {
      setSyncingId(item._id);
      setMenuId(null);
      setError("");
      setSuccess("");

      setList((current) =>
        current.map((file) =>
          file._id === item._id ? { ...file, backupStatus: "pending" } : file,
        ),
      );

      await api(`/api/google/sync/${item._id}`, { method: "POST" });

      setSuccess(`"${item.title}" was backed up successfully.`);
      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to back up this document.",
      );
      await loadDocuments();
    } finally {
      setSyncingId(null);
    }
  };

  const copyShareLink = async (item: DocumentItem) => {
    if (!item.googleWebViewLink) return;

    try {
      await navigator.clipboard.writeText(item.googleWebViewLink);
      setSuccess("Document link copied. Manage access in Google Drive.");
      setError("");
    } catch {
      setError("Unable to copy the document link.");
    }

    setMenuId(null);
  };

  const getBackupLabel = (status?: string) => {
    switch (status) {
      case "synced":
        return "Backed up";
      case "pending":
        return "Syncing";
      case "failed":
        return "Backup failed";
      default:
        return "Not backed up";
    }
  };

  const getBackupDot = (status?: string) => {
    switch (status) {
      case "synced":
        return "bg-green-500";
      case "pending":
        return "bg-orange-400 animate-pulse";
      default:
        return "bg-red-500";
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "Recently";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const filteredDocuments = useMemo(() => {
    let documents = [...list];

    if (search.trim()) {
      documents = documents.filter((item) =>
        item.title.toLowerCase().includes(search.trim().toLowerCase()),
      );
    }

    documents.sort((a, b) => {
      const dateA = new Date(a.updatedAt || 0).getTime();
      const dateB = new Date(b.updatedAt || 0).getTime();

      if (sortBy === "oldest") return dateA - dateB;
      if (sortBy === "name") return a.title.localeCompare(b.title);
      return dateB - dateA;
    });

    return documents;
  }, [list, search, sortBy]);

  const menuButtonClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-100 disabled:opacity-50";

  return (
    <div className="space-y-8 pb-10" onClick={() => setMenuId(null)}>
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${isDoc ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}
          >
            {isDoc ? "📄" : "📊"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Create and access your files.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn flex items-center justify-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            create();
          }}
          disabled={creating}
        >
          <span className="text-lg">＋</span>
          {creating
            ? "Creating..."
            : isDoc
              ? "New document"
              : "New spreadsheet"}
        </button>
      </div>

      {/* SEARCH */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400">
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search your ${name.toLowerCase()}...`}
            className="w-full rounded-2xl bg-gray-100 py-3.5 pl-12 pr-4 text-sm text-gray-800 shadow-sm outline-none transition placeholder:text-gray-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* TEMPLATES */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Start a new {isDoc ? "document" : "spreadsheet"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">Choose a starting point.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {templates.map((template) => (
            <button
              key={template.title}
              type="button"
              disabled={creating}
              onClick={(e) => {
                e.stopPropagation();
                create(template.title);
              }}
              className="group overflow-hidden rounded-xl bg-gray-100 text-left shadow-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-md disabled:opacity-50"
            >
              <div className="flex h-20 items-center justify-center bg-gray-200/70 p-3">
                <div
                  className={`flex h-12 w-10 items-center justify-center rounded-lg ${template.background} text-2xl shadow-sm ${template.color}`}
                >
                  {template.icon}
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {template.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                  {template.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* RECENT DOCUMENTS */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Recent documents</h2>
          <p className="mt-1 text-sm text-gray-500">
            {filteredDocuments.length}{" "}
            {filteredDocuments.length === 1 ? "file" : "files"}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="aspect-[4/3] animate-pulse rounded-lg bg-gray-100"
              />
            ))}
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredDocuments.map((item) => {
              const isMenuOpen = menuId === item._id;
              const hasBackup =
                item.backupStatus === "synced" && Boolean(item.backupFormat);
              const isSyncing = syncingId === item._id;

              return (
                <article
                  key={item._id}
                  className="group min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* DOCUMENT PREVIEW */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openDocument(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDocument(item);
                      }
                    }}
                    className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-t-lg bg-white shadow-sm ring-1 ring-inset ring-gray-300 transition hover:ring-blue-400"
                  >
                    <div className="absolute inset-0 overflow-hidden bg-white p-[7%]">
                      <div
                        className={`mb-[4%] h-1.5 w-[20%] rounded-full ${isDoc ? "bg-blue-500" : "bg-green-500"}`}
                      />

                      {isDoc ? (
                        <div className="grid grid-cols-[1fr_24%] gap-[5%]">
                          <div className="space-y-2">
                            <div className="h-1 w-full rounded-full bg-gray-200" />
                            <div className="h-1 w-[92%] rounded-full bg-gray-200" />
                            <div className="h-1 w-[85%] rounded-full bg-gray-200" />
                            <div className="h-1 w-full rounded-full bg-gray-200" />
                            <div className="h-1 w-[70%] rounded-full bg-gray-200" />
                            <div className="pt-2">
                              <div className="h-1 w-full rounded-full bg-gray-200" />
                              <div className="mt-2 h-1 w-[88%] rounded-full bg-gray-200" />
                              <div className="mt-2 h-1 w-[75%] rounded-full bg-gray-200" />
                            </div>
                          </div>
                          <div className="h-12 rounded-sm bg-gray-100" />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="grid grid-cols-4 gap-1">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-4 rounded-sm bg-green-100"
                              />
                            ))}
                          </div>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-4 gap-1">
                              {Array.from({ length: 4 }).map((__, j) => (
                                <div
                                  key={j}
                                  className="h-4 rounded-sm bg-gray-100"
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* BACKUP INDICATOR - TOP RIGHT */}
                    <div className="absolute right-2 top-2 z-10 rounded-full bg-white p-2 shadow-sm">
                      <span
                        className={`block h-2.5 w-2.5 rounded-full ${getBackupDot(item.backupStatus)}`}
                        title={getBackupLabel(item.backupStatus)}
                        aria-label={getBackupLabel(item.backupStatus)}
                      />
                    </div>
                  </div>

                  {/* DIVIDER */}
                  <div className="h-px w-full bg-gray-300" />

                  {/* TITLE */}
                  <div className="flex min-w-0 items-center justify-between gap-2 bg-white px-3 pt-3">
                    <button
                      type="button"
                      onClick={() => openDocument(item)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.title}
                      </p>
                    </button>
                  </div>

                  {/* FILE ICON, OPENED DATE AND THREE DOTS */}
                  <div className="relative flex items-center justify-between gap-2 rounded-b-lg bg-white px-3 pb-3 pt-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs text-white ${isDoc ? "bg-blue-500" : "bg-green-600"}`}
                      >
                        {isDoc ? "▤" : "▦"}
                      </span>
                      <span className="truncate text-xs text-gray-500">
                        Opened {formatDate(item.updatedAt)}
                      </span>
                    </div>

                    {/* THREE DOTS AT BOTTOM RIGHT */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label={`Options for ${item.title}`}
                        aria-expanded={isMenuOpen}
                        onClick={() => setMenuId(isMenuOpen ? null : item._id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-gray-600 transition hover:bg-gray-100"
                      >
                        ⋮
                      </button>

                      {isMenuOpen && (
                        <div
                          className="absolute bottom-10 right-0 z-50 w-56 rounded-xl bg-white p-2 shadow-xl ring-1 ring-gray-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={menuButtonClass}
                            onClick={() => {
                              openDocument(item);
                              setMenuId(null);
                            }}
                          >
                            <span>↗</span>
                            Open document
                          </button>

                          <button
                            type="button"
                            className={menuButtonClass}
                            onClick={() => copyShareLink(item)}
                          >
                            <span>🔗</span>
                            Copy share link
                          </button>

                          <div className="my-1 h-px bg-gray-100" />

                          <div className="px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              VPS backup
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${getBackupDot(item.backupStatus)}`}
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {getBackupLabel(item.backupStatus)}
                              </span>
                            </div>
                            {item.lastSyncedAt && (
                              <p className="mt-1 pl-4 text-xs text-gray-400">
                                {formatDate(item.lastSyncedAt)}
                              </p>
                            )}
                            {item.lastSyncError && (
                              <p className="mt-2 text-xs text-red-500">
                                {item.lastSyncError}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            className={menuButtonClass}
                            disabled={syncingId !== null}
                            onClick={() => syncBackup(item)}
                          >
                            <span>⟳</span>
                            {isSyncing
                              ? "Syncing..."
                              : hasBackup
                                ? "Sync backup again"
                                : "Sync backup"}
                          </button>

                          {hasBackup && (
                            <a
                              href={`/api/google/backup/${item._id}`}
                              download
                              onClick={() => setMenuId(null)}
                              className={menuButtonClass}
                            >
                              <span>↓</span>
                              Download backup
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-100 px-6 py-14 text-center shadow-sm">
            <div className="mb-3 text-4xl">{isDoc ? "📄" : "📊"}</div>
            <h3 className="font-semibold text-gray-900">
              {search ? "No matching documents" : "No documents yet"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : `Create your first ${isDoc ? "document" : "spreadsheet"} to get started.`}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => create()}
                disabled={creating}
                className="btn mt-4"
              >
                Create new
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
