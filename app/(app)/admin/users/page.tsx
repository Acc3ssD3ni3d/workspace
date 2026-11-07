"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
} from "lucide-react";

type User = {
  _id: string;
  name: string;
  email: string;
  personalEmail?: string;
  role: "admin" | "member";
  active: boolean;
  mailboxId?: string;
  mailboxStatus?: "pending" | "active" | "failed" | "not_created";
  invitationStatus?: "pending" | "sent" | "failed";
  createdAt?: string;
};

type EmployeeForm = {
  name: string;
  local: string;
  personalEmail: string;
  role: "admin" | "member";
};

const DOMAIN = "eduoneinternational.com";

const initialForm: EmployeeForm = {
  name: "",
  local: "",
  personalEmail: "",
  role: "member",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<EmployeeForm>(initialForm);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/api/admin/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Automatically dismiss notifications.
  useEffect(() => {
    if (!error && !success) return;

    const timer = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [error, success]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.personalEmail?.toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "active" && user.active) ||
        (filter === "disabled" && !user.active) ||
        (filter === "admin" && user.role === "admin") ||
        (filter === "mailbox_failed" && user.mailboxStatus === "failed") ||
        (filter === "invitation_failed" && user.invitationStatus === "failed");

      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  const stats = [
    { label: "Total users", value: users.length, icon: Users },
    {
      label: "Active",
      value: users.filter((user) => user.active).length,
      icon: CheckCircle2,
    },
    {
      label: "Disabled",
      value: users.filter((user) => !user.active).length,
      icon: AlertCircle,
    },
    {
      label: "Administrators",
      value: users.filter((user) => user.role === "admin").length,
      icon: ShieldCheck,
    },
  ];

  const createUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const local = form.local.trim().toLowerCase();
    const personalEmail = form.personalEmail.trim().toLowerCase();

    if (!form.name.trim()) {
      setError("Employee name is required.");
      return;
    }

    if (!/^[a-z0-9._-]{2,40}$/.test(local)) {
      setError("Enter a valid company email username.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) {
      setError("Enter a valid personal email address.");
      return;
    }

    setBusy(true);

    try {
      const result = await api("/api/admin/users", {
        method: "POST",
        body: {
          name: form.name.trim(),
          local,
          personalEmail,
          role: form.role,
        },
      });

      setSuccess(
        result.message ||
          `Employee account created: ${result.email || `${local}@${DOMAIN}`}`,
      );

      setForm(initialForm);
      setShowForm(false);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Unable to create employee account.");
    } finally {
      setBusy(false);
    }
  };

  const updateUser = async (id: string, body: Record<string, any>) => {
    setError("");
    setSuccess("");

    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: { id, ...body },
      });

      setSuccess("User updated successfully.");
      await loadUsers();
    } catch (e: any) {
      setError(e.message || "Unable to update user.");
    }
  };

  const resetPassword = (user: User) => {
    const password = prompt(
      `Enter a new password for ${user.name} (minimum 8 characters):`,
    );

    if (!password) return;

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    updateUser(user._id, { password });
  };

  const changeRole = (user: User) => {
    const nextRole = user.role === "admin" ? "member" : "admin";

    if (
      !confirm(
        `Change ${user.name}'s role to ${
          nextRole === "admin" ? "Administrator" : "Member"
        }?`,
      )
    ) {
      return;
    }

    updateUser(user._id, { role: nextRole });
  };

  const deleteUser = async (user: User) => {
    const confirmed = confirm(
      `Delete ${user.name} (${user.email})?\n\nThis will request deletion of their Hostinger mailbox and remove their EduOne workspace account. This action cannot be undone from this dashboard.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(user._id);

    try {
      const result = await api("/api/admin/users", {
        method: "DELETE",
        body: { id: user._id },
      });

      setUsers((current) => current.filter((item) => item._id !== user._id));

      setSuccess(result.message || "Employee deleted successfully.");
    } catch (e: any) {
      setError(e.message || "Unable to delete employee.");
    } finally {
      setDeletingId("");
    }
  };

  const Status = ({ value }: { value?: string }) => {
    const status = value || "not_created";

    const styles: Record<string, string> = {
      active: "bg-green-50 text-green-700",
      sent: "bg-green-50 text-green-700",
      failed: "bg-red-50 text-red-700",
      pending: "bg-amber-50 text-amber-700",
      not_created: "bg-slate-100 text-slate-600",
    };

    const labels: Record<string, string> = {
      active: "Created",
      sent: "Sent",
      failed: "Failed",
      pending: "Pending",
      not_created: "Not created",
    };

    const Icon =
      status === "active" || status === "sent"
        ? CheckCircle2
        : status === "failed"
          ? AlertCircle
          : Clock;

    return (
      <span
        className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${
          styles[status] || styles.not_created
        }`}
      >
        <Icon size={12} />
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold tracking-wide text-blue-600">
            ADMIN CONSOLE
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage employee accounts, company mailboxes and workspace access.
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowForm(true);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={17} />
          Add employee
        </button>
      </div>

      {/* Toast notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700"
        >
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">{stat.label}</p>
                <Icon size={17} className="shrink-0 text-blue-600" />
              </div>
              <h2 className="mt-1.5 text-2xl font-semibold text-slate-900">
                {loading ? "—" : stat.value}
              </h2>
            </div>
          );
        })}
      </div>

      {/* Employee directory */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-3.5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Employee directory
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filteredUsers.length} users found
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-52"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="all">All users</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="admin">Administrators</option>
              <option value="mailbox_failed">Mailbox failed</option>
              <option value="invitation_failed">Invitation failed</option>
            </select>

            <button
              onClick={loadUsers}
              disabled={loading}
              className="grid shrink-0 place-items-center rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              aria-label="Refresh users"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Desktop table: fixed columns, no horizontal scrolling */}
        <div className="hidden w-full min-w-0 lg:block">
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[17%]" />
            </colgroup>

            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-semibold">Employee</th>
                <th className="px-2 py-3 font-semibold">Role</th>
                <th className="px-2 py-3 font-semibold">Account</th>
                <th className="px-2 py-3 font-semibold">Mailbox</th>
                <th className="px-2 py-3 font-semibold">Invitation</th>
                <th className="px-2 py-3 font-semibold">Joined</th>
                <th className="px-2 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-sm text-slate-400"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-sm text-slate-400"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {user.name?.slice(0, 2).toUpperCase()}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {user.name}
                          </p>
                          <p
                            className="truncate text-xs text-slate-500"
                            title={user.email}
                          >
                            {user.email}
                          </p>
                          {user.personalEmail && (
                            <p
                              className="truncate text-[11px] text-slate-400"
                              title={user.personalEmail}
                            >
                              {user.personalEmail}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="overflow-hidden px-2 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                        {user.role === "admin" && (
                          <ShieldCheck
                            size={13}
                            className="shrink-0 text-blue-600"
                          />
                        )}
                        <span className="truncate">
                          {user.role === "admin" ? "Admin" : "Member"}
                        </span>
                      </span>
                    </td>

                    <td className="px-2 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium ${
                          user.active
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                        }`}
                      >
                        {user.active ? "Active" : "Disabled"}
                      </span>
                    </td>

                    <td className="px-2 py-3">
                      <Status value={user.mailboxStatus} />
                    </td>

                    <td className="px-2 py-3">
                      <Status value={user.invitationStatus} />
                    </td>

                    <td className="truncate px-2 py-3 text-xs text-slate-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Reset password"
                          onClick={() => resetPassword(user)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <KeyRound size={14} />
                        </button>

                        <button
                          title="Change role"
                          onClick={() => changeRole(user)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <ShieldCheck size={14} />
                        </button>

                        <button
                          title="Delete employee"
                          disabled={
                            deletingId === user._id ||
                            (user.role === "admin" && users.length === 1)
                          }
                          onClick={() => deleteUser(user)}
                          className="rounded-lg border border-red-100 p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingId === user._id ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Tablet and mobile cards */}
        <div className="divide-y divide-slate-100 lg:hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No users found.
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user._id} className="space-y-3 p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                    {user.name?.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user.email}
                    </p>
                    {user.personalEmail && (
                      <p className="truncate text-xs text-slate-400">
                        Personal: {user.personalEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {user.role === "admin" ? "Administrator" : "Member"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      user.active
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {user.active ? "Active" : "Disabled"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs text-slate-400">Mailbox</p>
                    <Status value={user.mailboxStatus} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-slate-400">Invitation</p>
                    <Status value={user.invitationStatus} />
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-2">
                  <button
                    onClick={() => resetPassword(user)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    title="Reset password"
                    aria-label="Reset password"
                  >
                    <KeyRound size={15} />
                  </button>

                  <button
                    onClick={() => changeRole(user)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    title="Change role"
                    aria-label="Change role"
                  >
                    <ShieldCheck size={15} />
                  </button>

                  <button
                    onClick={() => deleteUser(user)}
                    disabled={deletingId === user._id}
                    className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50 disabled:opacity-50"
                    title="Delete employee"
                    aria-label="Delete employee"
                  >
                    {deletingId === user._id ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Add employee modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setShowForm(false);
            }
          }}
        >
          <div className="my-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Add employee
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Create a workspace account and company mailbox.
                </p>
              </div>

              <button
                onClick={() => setShowForm(false)}
                disabled={busy}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={createUser}
              className="space-y-3 overflow-y-auto p-5"
            >
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter employee name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Company email
                </label>

                <div className="flex overflow-hidden rounded-lg border border-slate-200 focus-within:border-blue-500">
                  <div className="flex items-center pl-3 text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    required
                    value={form.local}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        local: e.target.value.toLowerCase().replace(/\s/g, ""),
                      })
                    }
                    placeholder="employee.name"
                    pattern="[a-z0-9._-]{2,40}"
                    className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                  />
                  <span className="flex items-center border-l border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500">
                    @{DOMAIN}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Used for workspace login and company email.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Personal email
                </label>
                <input
                  required
                  type="email"
                  value={form.personalEmail}
                  onChange={(e) =>
                    setForm({ ...form, personalEmail: e.target.value })
                  }
                  placeholder="employee@gmail.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Invitation and login details will be sent here.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Account role
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "admin" | "member",
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-900">
                  Automatic account setup
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-blue-800">
                  <li>• Generate a temporary password.</li>
                  <li>• Create the Hostinger company mailbox.</li>
                  <li>• Create the EduOne workspace account.</li>
                  <li>• Send the invitation through Resend.</li>
                </ul>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy ? "Creating account & mailbox..." : "Create employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
