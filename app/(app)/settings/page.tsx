"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

import {
  Settings,
  User,
  ShieldCheck,
  Mail,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  LockKeyhole,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

type GoogleConnectionStatus = {
  connected: boolean;
  account: {
    email: string;
    connectedAt: string | null;
    scopes: string[];
  } | null;
};

export default function SettingsPage() {
  const [connection, setConnection] = useState<GoogleConnectionStatus | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Personal email states
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [savedPersonalEmail, setSavedPersonalEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const loadConnection = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/google/connection");
      setConnection(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Google connection.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Loads the signed-in user's company email and personal email.
  useEffect(() => {
    api("/api/account/profile")
      .then((profile) => {
        setWorkspaceEmail(profile.email || "");
        setPersonalEmail(profile.personalEmail || "");
        setSavedPersonalEmail(profile.personalEmail || "");
      })
      .catch(() => {});
  }, []);

  const savePersonalEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setEmailError("");
    setEmailSuccess("");
    setSavingEmail(true);

    try {
      const result = await api("/api/account/profile", {
        method: "PATCH",
        body: { personalEmail },
      });

      setPersonalEmail(result.personalEmail || "");
      setSavedPersonalEmail(result.personalEmail || "");
      setEmailSuccess(result.message || "Personal email saved.");
    } catch (err) {
      setEmailError(
        err instanceof Error ? err.message : "Unable to save personal email.",
      );
    } finally {
      setSavingEmail(false);
    }
  };

  useEffect(() => {
    void loadConnection();

    const params = new URLSearchParams(window.location.search);
    const googleStatus = params.get("google");

    if (googleStatus === "connected") {
      setSuccess("Your Google account has been connected successfully.");

      window.history.replaceState({}, "", "/settings");
    } else if (googleStatus) {
      const messages: Record<string, string> = {
        invalid_state:
          "Google connection could not be verified. Please try again.",
        account_unavailable: "Your Workspace account is unavailable.",
        connection_failed:
          "Google account connection failed. Please try again.",
        error: "Google authorization was cancelled or denied.",
      };

      setError(messages[googleStatus] || "Google connection was unsuccessful.");

      window.history.replaceState({}, "", "/settings");
    }
  }, [loadConnection]);

  const connectGoogle = () => {
    setError("");
    setSuccess("");
    window.location.href = "/api/google/connect";
  };

  const disconnectGoogle = async () => {
    const confirmed = window.confirm(
      "Disconnect your Google account from EduOne Workspace?",
    );

    if (!confirmed) return;

    setDisconnecting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/google/connection", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to disconnect Google account.");
      }

      setConnection({
        connected: false,
        account: null,
      });

      setSuccess("Your Google account has been disconnected.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect Google account.",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  // Change password
  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "Your new password must be different from your current password.",
      );
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to change password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setPasswordSuccess(data.message || "Password changed successfully.");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Unable to change password.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Not available";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Not available";
    }

    return parsedDate.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const passwordFieldClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-11 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Page Header */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Settings size={16} />
          <span>Workspace</span>
          <span>/</span>
          <span className="text-slate-700">Settings</span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Manage your account, password, connected services and Workspace
          preferences.
        </p>
      </div>

      {/* General Feedback */}
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Account Settings */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <User size={22} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">Account settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your EduOne Workspace account.
            </p>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Workspace
            </p>
            <p className="mt-2 font-medium text-slate-800">EduOne Workspace</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Account access
            </p>
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-green-700">
              <ShieldCheck size={17} />
              Authenticated Workspace account
            </div>
          </div>

          {workspaceEmail && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Company email
              </p>
              <p className="mt-2 break-all font-medium text-slate-800">
                {workspaceEmail}
              </p>
            </div>
          )}
        </div>

        {/* Personal email */}
        <form
          onSubmit={savePersonalEmail}
          className="border-t border-slate-100 p-5 sm:p-6"
        >
          <label
            htmlFor="personal-email"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Personal email
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="personal-email"
              type="email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              autoComplete="email"
              disabled={savingEmail}
              className="inp min-w-0 flex-1"
            />

            <button
              type="submit"
              disabled={savingEmail || personalEmail.trim() === savedPersonalEmail}
              className="btn"
            >
              {savingEmail ? "Saving..." : "Save email"}
            </button>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Used for password reset links and for calendar and meeting
            notification emails. Employees receive one when an admin onboards
            them. Administrators can add their own here.
          </p>

          {emailSuccess && (
            <p className="mt-3 text-sm font-medium text-green-700">{emailSuccess}</p>
          )}

          {emailError && (
            <p className="mt-3 text-sm font-medium text-red-600">{emailError}</p>
          )}
        </form>
      </section>

      {/* Change Password */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-600">
            <LockKeyhole size={22} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">Change password</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update your EduOne Workspace login password.
            </p>
          </div>
        </div>

        <form onSubmit={changePassword} className="space-y-5 p-5 sm:p-6">
          {passwordSuccess && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{passwordSuccess}</p>
            </div>
          )}

          {passwordError && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p>{passwordError}</p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Current Password */}
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Current password
              </label>

              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                  className={passwordFieldClass}
                  disabled={changingPassword}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Toggle current password visibility"
                >
                  {showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New password
              </label>

              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  className={passwordFieldClass}
                  disabled={changingPassword}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Toggle new password visibility"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Minimum 8 characters.
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  className={passwordFieldClass}
                  disabled={changingPassword}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0 text-green-600"
              />
              Your password is securely hashed before being stored.
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPassword ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <KeyRound size={17} />
              )}

              {changingPassword ? "Updating password..." : "Update password"}
            </button>
          </div>
        </form>
      </section>

      {/* Google Integration */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Mail size={22} />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">Google account</h2>
              <p className="mt-1 text-sm text-slate-500">
                Connect Google services to your Workspace account.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadConnection()}
            disabled={loading || disconnecting}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <Loader2 size={20} className="animate-spin" />
              Checking Google account connection...
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-slate-600 shadow-sm">
                    <Mail size={19} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-800">
                        Google account connection
                      </p>

                      {connection?.connected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          <CheckCircle2 size={13} />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Not connected
                        </span>
                      )}
                    </div>

                    <p className="mt-1 break-all text-sm text-slate-500">
                      {connection?.account?.email ||
                        "No Google account connected"}
                    </p>
                  </div>
                </div>

                {connection?.connected ? (
                  <button
                    type="button"
                    onClick={() => void disconnectGoogle()}
                    disabled={disconnecting}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {disconnecting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Unlink size={16} />
                    )}

                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={connectGoogle}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Link2 size={16} />
                    Connect Google
                    <ExternalLink size={14} />
                  </button>
                )}
              </div>

              {connection?.connected && connection.account && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Connected Gmail
                    </p>
                    <p className="mt-2 break-all text-sm font-medium text-slate-800">
                      {connection.account.email}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Connected on
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-800">
                      {formatDate(connection.account.connectedAt)}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={19}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Your account, your access
                    </p>
                    <p className="mt-1 text-sm leading-6 text-blue-800">
                      Connect your own Google account to use supported Google
                      services. Your EduOne Workspace login remains separate.
                      Your Google connection is used for the services authorized
                      during sign-in.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Integration Information */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-purple-50 text-purple-600">
            <Settings size={21} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">Connected services</h2>
            <p className="mt-1 text-sm text-slate-500">
              Services available through your Google authorization.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {[
            {
              name: "Google Docs",
              description: "Create and manage documents.",
            },
            {
              name: "Google Sheets",
              description: "Create and manage spreadsheets.",
            },
            {
              name: "Google Drive API",
              description: "Manage files created or opened by this app.",
            },
            {
              name: "Google Calendar",
              description: "Calendar event access.",
            },
            {
              name: "Google Meet",
              description:
                "Meeting-space creation, subject to Google account eligibility.",
            },
          ].map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between gap-4 p-4 sm:px-6"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {service.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {service.description}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                {connection?.connected ? "Authorized account" : "Not connected"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-slate-400">
        EduOne Workspace · Account and integration settings
      </p>
    </div>
  );
}
