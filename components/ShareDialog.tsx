"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import Modal from "./Modal";

type ShareRole = "view" | "edit";

export default function ShareDialog({
  item,
  base,
  onClose,
}: {
  item: any;
  base: string;
  onClose: () => void;
}) {
  const [dir, setDir] = useState<any[]>([]);
  const [sh, setSh] = useState<any[]>(item.shared || []);
  const [org, setOrg] = useState(item.org || "none");
  const [u, setU] = useState("");
  const [r, setR] = useState<ShareRole>("view");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Public link state
  const [linkEnabled, setLinkEnabled] = useState(
    item.linkAccess?.enabled || false,
  );
  const [linkRole, setLinkRole] = useState<ShareRole>("view");
  const [expiryDays, setExpiryDays] = useState("30");
  const [shareUrl, setShareUrl] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const supportsLinks = base === "/api/files";

  useEffect(() => {
    api("/api/directory")
      .then((data: any) => {
        setDir(Array.isArray(data) ? data : []);
      })
      .catch(() => setErr("Unable to load employee directory."));
  }, []);

  const who = (id: string) => {
    const person = dir.find((d) => String(d._id) === String(id));

    return person ? `${person.name} · ${person.email}` : id;
  };

  const add = () => {
    if (!u) return;

    if (sh.some((x) => String(x.user) === String(u))) {
      setErr("This person already has access.");
      return;
    }

    setSh([...sh, { user: u, role: r }]);
    setU("");
    setErr("");
  };

  const save = async () => {
    setLoading(true);
    setErr("");

    try {
      await api(`${base}/${item._id}`, {
        method: "PATCH",
        body: { shared: sh, org },
      });

      onClose();
    } catch (e: any) {
      setErr(e.message || "Unable to save permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Generate or regenerate a public link.
  const generateLink = async () => {
    setLinkLoading(true);
    setErr("");
    setCopied(false);

    try {
      const result: any = await api(`/api/files/${item._id}/link`, {
        method: "POST",
        body: {
          role: linkRole,
          expiryDays: expiryDays === "never" ? null : Number(expiryDays),
        },
      });

      setShareUrl(result.shareUrl);
      setLinkEnabled(true);
    } catch (e: any) {
      setErr(e.message || "Unable to generate sharing link.");
    } finally {
      setLinkLoading(false);
    }
  };

  // Revoke an active public link.
  const revokeLink = async () => {
    if (
      !window.confirm(
        "Revoke this sharing link? Anyone using it will lose access.",
      )
    ) {
      return;
    }

    setLinkLoading(true);
    setErr("");

    try {
      await api(`/api/files/${item._id}/link`, {
        method: "DELETE",
      });

      setLinkEnabled(false);
      setShareUrl("");
      setCopied(false);
    } catch (e: any) {
      setErr(e.message || "Unable to revoke sharing link.");
    } finally {
      setLinkLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setErr("Unable to copy link. Please copy it manually.");
    }
  };

  const isPrivate = sh.length === 0 && org === "none" && !linkEnabled;

  return (
    <Modal title={`Share "${item.name || item.title}"`} onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto">
        {/* CURRENT ACCESS STATUS */}
        <section className="rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isPrivate ? "🔒" : "🌐"}</span>

            <div>
              <p className="text-sm font-semibold">
                {isPrivate ? "Private" : "Shared"}
              </p>

              <p className="text-xs text-gray-500">
                {isPrivate
                  ? "Only the owner and authorised administrators can access this item."
                  : "Other people or groups may have access to this item."}
              </p>
            </div>
          </div>
        </section>

        {/* SPECIFIC PEOPLE */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">
            Share with specific people
          </h3>

          <div className="flex flex-wrap gap-2">
            <select
              className="inp min-w-0 flex-1"
              value={u}
              onChange={(e) => setU(e.target.value)}
            >
              <option value="">Add a person...</option>

              {dir
                .filter(
                  (d) => !sh.some((x) => String(x.user) === String(d._id)),
                )
                .map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} · {d.email}
                  </option>
                ))}
            </select>

            <select
              className="inp"
              value={r}
              onChange={(e) => setR(e.target.value as ShareRole)}
            >
              <option value="view">Viewer</option>
              <option value="edit">Editor</option>
            </select>

            <button type="button" className="btn2" onClick={add} disabled={!u}>
              Add
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {sh.map((x) => (
              <div
                key={String(x.user)}
                className="flex items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{who(String(x.user))}</p>
                </div>

                <select
                  className="inp w-auto py-1"
                  value={x.role}
                  onChange={(e) =>
                    setSh((prev) =>
                      prev.map((y) =>
                        String(y.user) === String(x.user)
                          ? { ...y, role: e.target.value }
                          : y,
                      ),
                    )
                  }
                >
                  <option value="view">Viewer</option>
                  <option value="edit">Editor</option>
                </select>

                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() =>
                    setSh((prev) =>
                      prev.filter((y) => String(y.user) !== String(x.user)),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}

            {sh.length === 0 && (
              <p className="text-xs text-gray-500">
                No individual users added.
              </p>
            )}
          </div>
        </section>

        {/* ORGANISATION ACCESS */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">General access</h3>

          <select
            className="inp w-full"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          >
            <option value="none">Restricted – only selected people</option>
            <option value="view">Everyone in organisation – Viewer</option>
            <option value="edit">Everyone in organisation – Editor</option>
          </select>
        </section>

        {/* PUBLIC LINK SHARING */}
        {supportsLinks && (
          <section className="rounded-xl border p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Anyone with the link</h3>
                <p className="text-xs text-gray-500">
                  Allow access without selecting an employee.
                </p>
              </div>

              <span className="text-lg">🔗</span>
            </div>

            {linkEnabled && (
              <div className="mb-3 rounded-lg bg-green-50 p-3">
                <p className="text-sm font-medium text-green-800">
                  Sharing link is active
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Anyone with the current link can view this file.
                </p>
              </div>
            )}

            <label className="mb-1 block text-xs font-medium">
              Link permission
            </label>

            <select
              className="inp mb-3 w-full"
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as ShareRole)}
            >
              <option value="view">Viewer</option>
            </select>

            <label className="mb-1 block text-xs font-medium">
              Link expiration
            </label>

            <select
              className="inp mb-3 w-full"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="never">Never expires</option>
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                onClick={generateLink}
                disabled={linkLoading}
              >
                {linkLoading
                  ? "Please wait..."
                  : linkEnabled
                    ? "Generate new link"
                    : "Create link"}
              </button>

              {linkEnabled && (
                <button
                  type="button"
                  className="btn2"
                  onClick={revokeLink}
                  disabled={linkLoading}
                >
                  Revoke link
                </button>
              )}
            </div>

            {shareUrl && (
              <div className="mt-3 rounded-lg border p-2">
                <p className="break-all text-xs text-gray-600">{shareUrl}</p>

                <button
                  type="button"
                  className="btn2 mt-2 w-full"
                  onClick={copyLink}
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-500">
              Generating a new link invalidates the previous link. Public links
              currently support viewing and downloading, not anonymous editing.
            </p>
          </section>
        )}

        {err && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{err}</p>
        )}

        {/* ACTIONS */}
        <div className="flex justify-end gap-2 border-t pt-3">
          <button type="button" className="btn2" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="btn"
            onClick={save}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save permissions"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
