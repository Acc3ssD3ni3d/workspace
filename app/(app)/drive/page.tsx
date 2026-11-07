"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HardDrive,
  Folder,
  FolderPlus,
  Upload,
  Search,
  Grid2X2,
  List,
  ArrowUpDown,
  ChevronRight,
  Home,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  File,
  Download,
  Share2,
  Pencil,
  Trash2,
  RotateCcw,
  MoreVertical,
  X,
  RefreshCw,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Image as ImageIcon,
  Info,
  Globe,
  Lock,
} from "lucide-react";

import { api, sizeFmt } from "@/lib/client";
import Modal from "@/components/Modal";
import ShareDialog from "@/components/ShareDialog";
import FileInfoDialog from "@/components/FileInfoDialog";

const CHUNK = 8 * 1024 * 1024;

const WORKSPACE_DOC = "application/x-workspace-doc";
const WORKSPACE_SHEET = "application/x-workspace-sheet";

type DriveItem = {
  _id: string;
  name: string;
  type: "folder" | "file";
  mime?: string;
  size: number;
  uploaded: number;
  role?: string;
  org?: "none" | "view" | "edit";
  createdAt?: string;
  updatedAt?: string;

  // Google Docs and Sheets
  googleFileId?: string;
  googleWebViewLink?: string;
  googleResourceType?: "document" | "spreadsheet" | "";
  storageProvider?: "local" | "google";
};

type UploadItem = {
  id: string;
  name: string;
  pct: number;
  done?: boolean;
  err?: string;
};

const isWorkspaceDocument = (item: DriveItem) =>
  item.mime === WORKSPACE_DOC || item.mime === WORKSPACE_SHEET;

const getFileIcon = (item: DriveItem) => {
  if (item.type === "folder") return Folder;
  if (item.mime?.startsWith("image/")) return FileImage;
  if (item.mime?.startsWith("video/")) return FileVideo;
  if (item.mime?.startsWith("audio/")) return FileAudio;
  if (item.mime?.includes("pdf")) return FileText;
  if (item.mime?.includes("spreadsheet")) return FileText;
  return File;
};

const getFileColor = (item: DriveItem) => {
  if (item.type === "folder") return "bg-amber-50 text-amber-600";
  if (item.mime?.startsWith("image/")) return "bg-purple-50 text-purple-600";
  if (item.mime?.startsWith("video/")) return "bg-pink-50 text-pink-600";
  if (item.mime?.startsWith("audio/")) return "bg-orange-50 text-orange-600";
  if (item.mime?.includes("pdf")) return "bg-red-50 text-red-600";
  if (item.mime?.includes("spreadsheet") || item.mime === WORKSPACE_SHEET) {
    return "bg-green-50 text-green-600";
  }
  if (item.mime === WORKSPACE_DOC) {
    return "bg-blue-50 text-blue-600";
  }
  return "bg-blue-50 text-blue-600";
};

/**
 * Compact pill-style toggle to flip visibility between
 * Public (EduOne) and Private without opening the 3-dot menu.
 */
function VisibilityPill({
  item,
  onToggle,
  busy,
}: {
  item: DriveItem;
  onToggle: (item: DriveItem) => void;
  busy: boolean;
}) {
  const isPublic = item.org === "view";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(item);
      }}
      disabled={busy}
      title={
        isPublic
          ? "Public to EduOne — click to make private"
          : "Private — click to make public to EduOne"
      }
      aria-label={isPublic ? "Make private" : "Make public to EduOne"}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 ${
        isPublic
          ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
      }`}
    >
      {isPublic ? (
        <>
          <Globe size={11} />
          Public
        </>
      ) : (
        <>
          <Lock size={11} />
          Private
        </>
      )}
    </button>
  );
}

export default function Drive() {
  const [view, setView] = useState("mine");
  const [path, setPath] = useState<DriveItem[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [used, setUsed] = useState(0);
  const [quota, setQuota] = useState(1);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [share, setShare] = useState<DriveItem | null>(null);
  const [preview, setPreview] = useState<DriveItem | null>(null);
  const [info, setInfo] = useState<DriveItem | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const parent = path.at(-1)?._id || "";

  // Close the open menu when clicking outside or pressing Escape.
  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-drive-menu-root]")) {
        setOpenMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await api(`/api/files?view=${view}&parent=${parent}`);

      setItems(data.items || []);
      setUsed(data.used || 0);
      setQuota(data.quota || 1);
      setError("");
    } catch (e: any) {
      setError(e.message || "Unable to load files.");
    } finally {
      setLoading(false);
    }
  }, [view, parent]);

  useEffect(() => {
    load();
  }, [load]);

  const updateUpload = (id: string, changes: Partial<UploadItem>) => {
    setUploads((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  async function uploadFile(file: File) {
    if (file.size === 0) {
      const id = crypto.randomUUID();

      setUploads((current) => [
        ...current,
        {
          id,
          name: file.name,
          pct: 0,
          err: "Empty files are not supported yet.",
        },
      ]);

      return;
    }

    const id = crypto.randomUUID();

    setUploads((current) => [...current, { id, name: file.name, pct: 0 }]);

    try {
      const item = await api("/api/files", {
        method: "POST",
        body: {
          type: "file",
          name: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          parent,
        },
      });

      let offset = 0;

      while (offset < file.size) {
        let completed = false;

        for (let attempt = 0; attempt < 6 && !completed; attempt++) {
          try {
            const response = await fetch(`/api/files/${item._id}`, {
              method: "PUT",
              headers: {
                "Upload-Offset": String(offset),
              },
              body: file.slice(offset, offset + CHUNK),
            });

            if (response.ok) {
              const result = await response.json();
              offset = result.offset;
              completed = true;
            } else {
              const head = await fetch(`/api/files/${item._id}`, {
                method: "HEAD",
              });

              if (head.ok) {
                const actualOffset = Number(
                  head.headers.get("upload-offset") || 0,
                );

                if (actualOffset > offset) {
                  offset = actualOffset;
                  completed = true;
                } else {
                  throw new Error("Upload could not continue.");
                }
              } else {
                throw new Error("Upload failed.");
              }
            }
          } catch (e) {
            if (attempt === 5) throw e;

            await new Promise((resolve) =>
              setTimeout(resolve, 1200 * (attempt + 1)),
            );

            const head = await fetch(`/api/files/${item._id}`, {
              method: "HEAD",
            }).catch(() => null);

            if (head?.ok) {
              offset = Number(head.headers.get("upload-offset") || offset);

              if (offset >= file.size) completed = true;
            }
          }
        }

        if (!completed && offset < file.size) {
          throw new Error("Network problem. Please retry.");
        }

        updateUpload(id, {
          pct: Math.min(100, Math.round((offset / file.size) * 100)),
        });
      }

      updateUpload(id, { pct: 100, done: true });
      await load();
    } catch (e: any) {
      updateUpload(id, {
        err: e.message || "Upload failed.",
      });
    }
  }

  function handleFiles(files: FileList | File[]) {
    Array.from(files).forEach(uploadFile);
  }

  async function createFolder() {
    const name = prompt("Enter folder name");

    if (!name?.trim()) return;

    try {
      await api("/api/files", {
        method: "POST",
        body: {
          type: "folder",
          name: name.trim(),
          parent,
        },
      });

      await load();
    } catch (e: any) {
      setError(e.message || "Could not create folder.");
    }
  }

  async function updateItem(id: string, body: any) {
    try {
      await api(`/api/files/${id}`, {
        method: "PATCH",
        body,
      });

      await load();
    } catch (e: any) {
      setError(e.message || "Action failed.");
    }
  }

  async function toggleVisibility(item: DriveItem) {
    const newOrg = item.org === "view" ? "none" : "view";

    // Optimistic update so the pill flips instantly.
    setItems((current) =>
      current.map((it) => (it._id === item._id ? { ...it, org: newOrg } : it)),
    );
    setTogglingId(item._id);

    try {
      await api(`/api/files/${item._id}`, {
        method: "PATCH",
        body: { org: newOrg },
      });
    } catch (e: any) {
      // Revert on failure.
      setItems((current) =>
        current.map((it) =>
          it._id === item._id ? { ...it, org: item.org } : it,
        ),
      );
      setError(e.message || "Unable to update visibility.");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteForever(id: string) {
    if (!confirm("Permanently delete this item? This cannot be undone.")) {
      return;
    }

    try {
      await api(`/api/files/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message || "Unable to delete item.");
    }
  }

  function openItem(item: DriveItem) {
    if (item.type === "folder") {
      setPath((current) => [...current, item]);
      setSearch("");
      setOpenMenuId(null);
      return;
    }

    // Open actual Google Docs and Sheets.
    if (isWorkspaceDocument(item)) {
      const googleUrl =
        item.googleWebViewLink ||
        (item.googleFileId
          ? item.mime === WORKSPACE_DOC
            ? `https://docs.google.com/document/d/${item.googleFileId}/edit`
            : `https://docs.google.com/spreadsheets/d/${item.googleFileId}/edit`
          : "");

      if (!googleUrl) {
        setError(
          "Google file link is missing. Please contact the administrator.",
        );
        return;
      }

      window.open(googleUrl, "_blank", "noopener,noreferrer");
      setOpenMenuId(null);
      return;
    }

    // Normal VPS files retain their existing behaviour.
    if (item.uploaded < item.size) {
      setError("This file is still uploading or incomplete.");
      return;
    }

    if (
      item.mime?.startsWith("image/") ||
      item.mime?.startsWith("video/") ||
      item.mime?.startsWith("audio/") ||
      item.mime?.includes("pdf")
    ) {
      setPreview(item);
      return;
    }

    window.location.href = `/api/files/${item._id}?dl=1`;
  }

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    );

    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return b.size - a.size;

      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });
  }, [items, search, sort]);

  const usage = quota > 0 ? (used / quota) * 100 : 0;

  const usageColor =
    usage >= 93 ? "bg-red-500" : usage >= 80 ? "bg-amber-500" : "bg-blue-600";

  const completeUploads = uploads.filter((u) => u.done).length;
  const activeUploads = uploads.filter((u) => !u.done && !u.err).length;

  const closeMenu = () => setOpenMenuId(null);

  return (
    <div
      className="mx-auto max-w-7xl space-y-7 pb-10"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);

        if (view !== "trash" && e.dataTransfer.files.length) {
          handleFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-600">
            <HardDrive size={17} />
            WORKSPACE STORAGE
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            My Drive
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Your files, folders and shared documents in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {view !== "trash" && (
            <>
              <button
                onClick={createFolder}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FolderPlus size={17} />
                New folder
              </button>

              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Upload size={17} />
                Upload files
              </button>

              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}

          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Storage card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <HardDrive size={23} />
            </div>

            <div>
              <p className="font-semibold text-slate-900">Workspace storage</p>
              <p className="mt-1 text-sm text-slate-500">
                {sizeFmt(used)} used of {sizeFmt(quota)}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold text-slate-900">
              {Math.min(100, usage).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">Storage used</p>
          </div>
        </div>

        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${usageColor}`}
            style={{ width: `${Math.min(100, usage)}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
          <span>{sizeFmt(used)} used</span>
          <span>{sizeFmt(Math.max(0, quota - used))} available</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside className="space-y-2">
          {[
            { id: "mine", label: "My Drive", icon: HardDrive },
            { id: "shared", label: "Shared with me", icon: Share2 },
            { id: "trash", label: "Trash", icon: Trash2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = view === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setView(tab.id);
                  setPath([]);
                  setSearch("");
                  setError("");
                  closeMenu();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon size={19} />
                {tab.label}
              </button>
            );
          })}

          <div className="mt-7 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-blue-700">
              <CloudUpload size={18} />
              <span className="text-sm font-semibold">Quick tip</span>
            </div>
            <p className="text-xs leading-5 text-slate-600">
              Drag and drop files anywhere in this Drive area to upload them.
            </p>
          </div>
        </aside>

        {/* File area */}
        <section className="min-w-0">
          {/* Breadcrumbs */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => {
                setPath([]);
                closeMenu();
              }}
              className="inline-flex items-center gap-1.5 font-semibold text-slate-600 hover:text-blue-600"
            >
              <Home size={16} />
              {view === "shared"
                ? "Shared"
                : view === "trash"
                  ? "Trash"
                  : "My Drive"}
            </button>

            {path.map((folder, index) => (
              <span key={folder._id} className="flex items-center gap-2">
                <ChevronRight size={15} className="text-slate-400" />
                <button
                  onClick={() => {
                    setPath(path.slice(0, index + 1));
                    closeMenu();
                  }}
                  className={`max-w-36 truncate font-semibold ${
                    index === path.length - 1
                      ? "text-blue-600"
                      : "text-slate-500 hover:text-blue-600"
                  }`}
                >
                  {folder.name}
                </button>
              </span>
            ))}
          </div>

          {/* Search and controls */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search files and folders..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 outline-none sm:flex-none"
              >
                <option value="name">Name</option>
                <option value="date">Last modified</option>
                <option value="size">File size</option>
              </select>

              <div className="flex rounded-xl border border-slate-200 bg-white p-1">
                <button
                  onClick={() => {
                    setLayout("grid");
                    closeMenu();
                  }}
                  title="Grid view"
                  className={`grid h-8 w-9 place-items-center rounded-lg ${
                    layout === "grid"
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Grid2X2 size={17} />
                </button>

                <button
                  onClick={() => {
                    setLayout("list");
                    closeMenu();
                  }}
                  title="List view"
                  className={`grid h-8 w-9 place-items-center rounded-lg ${
                    layout === "list"
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <List size={18} />
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span className="flex items-center gap-2">
                <AlertCircle size={17} />
                {error}
              </span>
              <button onClick={() => setError("")}>
                <X size={17} />
              </button>
            </div>
          )}

          {/* Upload progress */}
          {uploads.length > 0 && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  <CloudUpload size={18} className="text-blue-600" />
                  Upload activity
                </div>

                <button
                  onClick={() => setUploads([])}
                  className="text-xs font-semibold text-slate-500 hover:text-red-600"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3">
                {uploads.map((upload) => (
                  <div key={upload.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-medium text-slate-700">
                        {upload.name}
                      </span>

                      <span
                        className={
                          upload.err
                            ? "shrink-0 text-red-600"
                            : upload.done
                              ? "shrink-0 text-green-600"
                              : "shrink-0 text-slate-500"
                        }
                      >
                        {upload.err ||
                          (upload.done ? "Completed" : `${upload.pct}%`)}
                      </span>
                    </div>

                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          upload.err
                            ? "bg-red-500"
                            : upload.done
                              ? "bg-green-500"
                              : "bg-blue-600"
                        }`}
                        style={{ width: `${upload.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-400">
                {activeUploads} active · {completeUploads} completed
              </p>
            </div>
          )}

          {/* File heading */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">
              {view === "trash"
                ? "Deleted items"
                : view === "shared"
                  ? "Shared files"
                  : path.length
                    ? path[path.length - 1].name
                    : "All files"}
            </h2>

            <span className="text-xs text-slate-400">
              {filteredItems.length} items
            </span>
          </div>

          {/* Drag and drop overlay */}
          {dragging && view !== "trash" && (
            <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-blue-600/10 backdrop-blur-sm">
              <div className="rounded-3xl border-2 border-dashed border-blue-500 bg-white p-12 text-center shadow-2xl">
                <CloudUpload size={48} className="mx-auto mb-4 text-blue-600" />
                <h3 className="text-xl font-bold text-slate-900">
                  Drop your files here
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Your files will be uploaded to this folder.
                </p>
              </div>
            </div>
          )}

          {/* File cards */}
          {loading ? (
            <div className="grid min-h-52 place-items-center rounded-2xl border border-slate-200 bg-white">
              <div className="text-center text-sm text-slate-500">
                <RefreshCw
                  size={24}
                  className="mx-auto mb-3 animate-spin text-blue-600"
                />
                Loading your files...
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div>
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  {search ? (
                    <Search size={28} />
                  ) : view === "trash" ? (
                    <Trash2 size={28} />
                  ) : (
                    <Folder size={30} />
                  )}
                </div>

                <h3 className="font-semibold text-slate-900">
                  {search
                    ? "No matching files"
                    : view === "trash"
                      ? "Your trash is empty"
                      : "This folder is empty"}
                </h3>

                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {search
                    ? "Try another search term."
                    : view === "trash"
                      ? "Deleted items will appear here."
                      : "Upload files or create a folder to get started."}
                </p>

                {!search && view !== "trash" && (
                  <div className="mt-5 flex justify-center gap-2">
                    <button
                      onClick={createFolder}
                      className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      New folder
                    </button>
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Upload files
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={
                layout === "grid"
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
                  : "overflow-hidden rounded-2xl border border-slate-200 bg-white"
              }
            >
              {filteredItems.map((item) => {
                const Icon = getFileIcon(item);
                const color = getFileColor(item);
                const incomplete =
                  item.type === "file" &&
                  !isWorkspaceDocument(item) &&
                  item.uploaded < item.size;

                const menuOpen = openMenuId === item._id;
                const workspaceDocument = isWorkspaceDocument(item);
                const canToggleVisibility =
                  item.role === "owner" && view !== "trash";

                return (
                  <div
                    key={item._id}
                    className={
                      layout === "grid"
                        ? "group rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                        : "flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"
                    }
                  >
                    <div
                      className={
                        layout === "grid"
                          ? "mb-4 flex items-center justify-between"
                          : "flex min-w-0 flex-1 items-center gap-3"
                      }
                    >
                      <button
                        onClick={() => openItem(item)}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <div
                          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${color}`}
                        >
                          <Icon size={23} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                            {item.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {item.type === "folder"
                              ? "Folder"
                              : workspaceDocument
                                ? item.mime === WORKSPACE_DOC
                                  ? "Google Docs document"
                                  : "Google Sheets spreadsheet"
                                : sizeFmt(item.size)}
                          </p>
                        </div>
                      </button>

                      {layout === "grid" && (
                        <div className="relative" data-drive-menu-root>
                          <button
                            type="button"
                            title="More actions"
                            aria-label={`More actions for ${item.name}`}
                            aria-expanded={menuOpen}
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === item._id ? null : item._id,
                              )
                            }
                            className={`grid h-8 w-8 place-items-center rounded-lg transition ${
                              menuOpen
                                ? "bg-slate-100 text-slate-700"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            }`}
                          >
                            <MoreVertical size={18} />
                          </button>

                          {menuOpen && (
                            <div
                              onClick={(event) => {
                                const target = event.target as HTMLElement;

                                if (target.closest("button, a")) {
                                  setOpenMenuId(null);
                                }
                              }}
                              className="absolute right-0 top-9 z-50 min-w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                            >
                              {view === "trash" ? (
                                <>
                                  <button
                                    onClick={() =>
                                      updateItem(item._id, {
                                        trashed: false,
                                      })
                                    }
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                                  >
                                    <RotateCcw size={15} /> Restore
                                  </button>

                                  <button
                                    onClick={() => deleteForever(item._id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 size={15} /> Delete forever
                                  </button>
                                </>
                              ) : (
                                <>
                                  {item.role === "owner" && (
                                    <button
                                      onClick={() => setShare(item)}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                                    >
                                      <Share2 size={15} /> Share
                                    </button>
                                  )}

                                  {item.role !== "view" && (
                                    <>
                                      {!workspaceDocument && (
                                        <button
                                          onClick={() => {
                                            const name = prompt(
                                              "Rename item",
                                              item.name,
                                            );

                                            if (name?.trim()) {
                                              updateItem(item._id, {
                                                name: name.trim(),
                                              });
                                            }
                                          }}
                                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                                        >
                                          <Pencil size={15} /> Rename
                                        </button>
                                      )}

                                      <button
                                        onClick={() =>
                                          updateItem(item._id, {
                                            trashed: true,
                                          })
                                        }
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                      >
                                        <Trash2 size={15} /> Move to trash
                                      </button>
                                    </>
                                  )}

                                  {item.type === "file" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setInfo(item)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-600"
                                      >
                                        <Info size={15} /> File information
                                      </button>

                                      {!workspaceDocument && (
                                        <a
                                          href={`/api/files/${item._id}?dl=1`}
                                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"
                                        >
                                          <Download size={15} /> Download
                                        </a>
                                      )}
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {incomplete && (
                      <p className="mb-2 text-xs text-amber-600">
                        Upload incomplete
                      </p>
                    )}

                    {/* Grid-only visibility pill row */}
                    {layout === "grid" && canToggleVisibility && (
                      <div className="mt-1 flex items-center justify-between">
                        <VisibilityPill
                          item={item}
                          onToggle={toggleVisibility}
                          busy={togglingId === item._id}
                        />
                        <span className="text-[10px] text-slate-400">
                          {item.org === "view"
                            ? "Visible to EduOne"
                            : "Only you & shared"}
                        </span>
                      </div>
                    )}

                    {layout === "list" && (
                      <>
                        <span className="hidden text-xs text-slate-400 sm:block">
                          {item.type === "file" ? sizeFmt(item.size) : "—"}
                        </span>

                        {canToggleVisibility && (
                          <VisibilityPill
                            item={item}
                            onToggle={toggleVisibility}
                            busy={togglingId === item._id}
                          />
                        )}

                        <div className="ml-auto flex items-center gap-1">
                          {view === "trash" ? (
                            <>
                              <button
                                onClick={() =>
                                  updateItem(item._id, { trashed: false })
                                }
                                title="Restore"
                                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                              >
                                <RotateCcw size={17} />
                              </button>

                              <button
                                onClick={() => deleteForever(item._id)}
                                title="Delete forever"
                                className="grid h-9 w-9 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                              >
                                <Trash2 size={17} />
                              </button>
                            </>
                          ) : (
                            <>
                              {item.type === "file" && (
                                <>
                                  {!workspaceDocument && (
                                    <a
                                      href={`/api/files/${item._id}?dl=1`}
                                      title="Download"
                                      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                    >
                                      <Download size={17} />
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setInfo(item)}
                                    title="File information"
                                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                  >
                                    <Info size={17} />
                                  </button>
                                </>
                              )}

                              {item.role === "owner" && (
                                <button
                                  onClick={() => setShare(item)}
                                  title="Share"
                                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600"
                                >
                                  <Share2 size={17} />
                                </button>
                              )}

                              {item.role !== "view" && (
                                <>
                                  {!workspaceDocument && (
                                    <button
                                      onClick={() => {
                                        const name = prompt(
                                          "Rename item",
                                          item.name,
                                        );

                                        if (name?.trim()) {
                                          updateItem(item._id, {
                                            name: name.trim(),
                                          });
                                        }
                                      }}
                                      title="Rename"
                                      className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                                    >
                                      <Pencil size={17} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() =>
                                      updateItem(item._id, {
                                        trashed: true,
                                      })
                                    }
                                    title="Move to trash"
                                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 size={17} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Share dialog */}
      {share && (
        <ShareDialog
          item={share}
          base="/api/files"
          onClose={() => {
            setShare(null);
            load();
          }}
        />
      )}

      {/* File information */}
      {info && <FileInfoDialog item={info} onClose={() => setInfo(null)} />}

      {/* File preview */}
      {preview && (
        <Modal title={preview.name} wide onClose={() => setPreview(null)}>
          {preview.mime?.startsWith("video/") ? (
            <video
              src={`/api/files/${preview._id}`}
              controls
              className="max-h-[70vh] w-full rounded-xl bg-black"
            />
          ) : preview.mime?.startsWith("audio/") ? (
            <audio
              src={`/api/files/${preview._id}`}
              controls
              className="w-full"
            />
          ) : preview.mime?.startsWith("image/") ? (
            <img
              src={`/api/files/${preview._id}`}
              alt={preview.name}
              className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain"
            />
          ) : (
            <iframe
              src={`/api/files/${preview._id}`}
              title={preview.name}
              className="h-[70vh] w-full rounded-xl"
            />
          )}
        </Modal>
      )}
    </div>
  );
}
