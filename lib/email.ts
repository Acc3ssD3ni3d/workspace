import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

const resend = apiKey ? new Resend(apiKey) : null;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

type InvitationOptions = {
  name: string;
  personalEmail: string;
  companyEmail: string;
  temporaryPassword: string;
  loginUrl: string;
};

export async function sendEmployeeInvitation({
  name,
  personalEmail,
  companyEmail,
  temporaryPassword,
  loginUrl,
}: InvitationOptions) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || "EduOne International";

  if (!fromEmail) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  const safeName = escapeHtml(name);
  const safeCompanyEmail = escapeHtml(companyEmail);
  const safePassword = escapeHtml(temporaryPassword);
  const safeLoginUrl = escapeHtml(loginUrl);

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [personalEmail],
    subject: "Your EduOne International Workspace Account",
    html: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:32px;background:#f4f6fa;font-family:Arial,sans-serif;color:#1e293b;">
          <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;padding:32px;">
            <h2 style="margin-top:0;color:#1d4ed8;">Welcome to EduOne International</h2>

            <p>Hello ${safeName},</p>

            <p>Your company workspace account has been created.</p>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:24px 0;">
              <p><strong>Company email</strong></p>
              <p>${safeCompanyEmail}</p>

              <p><strong>Temporary password</strong></p>
              <p style="font-family:monospace;">${safePassword}</p>
            </div>

            <p>
              <a href="${safeLoginUrl}"
                 style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold;">
                Open Workspace
              </a>
            </p>

            <p style="font-size:13px;color:#64748b;">
              For security, sign in and change your temporary password as soon as possible.
              Do not share these credentials with anyone.
            </p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;" />

            <p style="font-size:12px;color:#94a3b8;">
              EduOne International · Workspace Invitation
            </p>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to EduOne International, ${name}.

Your workspace account has been created.

Company email: ${companyEmail}
Temporary password: ${temporaryPassword}

Login: ${loginUrl}

Please sign in and change your temporary password immediately.
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send invitation email");
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email ID");
  }

  return {
    emailId: data.id,
    sent: true,
  };
}


type PasswordResetOptions = {
  name: string;
  personalEmail: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail({
  name,
  personalEmail,
  resetUrl,
}: PasswordResetOptions) {
  if (!resend) throw new Error("RESEND_API_KEY is not configured");

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || "EduOne International";
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL is not configured");

  const safeName = escapeHtml(name);
  const safeResetUrl = escapeHtml(resetUrl);

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [personalEmail],
    subject: "Reset your EduOne Workspace password",
    html: `
      <!DOCTYPE html>
      <html><body style="margin:0;padding:32px;background:#f4f6fa;font-family:Arial,sans-serif;color:#1e293b;">
        <div style="max-width:600px;margin:auto;background:#fff;border-radius:14px;padding:32px;">
          <h2 style="margin-top:0;color:#1d4ed8;">Password reset request</h2>
          <p>Hello ${safeName},</p>
          <p>We received a request to reset your EduOne Workspace password.</p>
          <p><a href="${safeResetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold;">Reset password</a></p>
          <p>This link expires in 30 minutes and can be used only once.</p>
          <p>If you did not request this, you can safely ignore this email. Your password will not change.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;" />
          <p style="font-size:12px;color:#94a3b8;">EduOne International · Workspace</p>
        </div>
      </body></html>
    `,
    text: `Hello ${name},\n\nWe received a request to reset your EduOne Workspace password.\n\nOpen this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, ignore this email. Your password will not change.`,
  });

  if (error) throw new Error(error.message || "Failed to send password reset email");
  if (!data?.id) throw new Error("Resend did not return an email ID");
  return { emailId: data.id, sent: true };
}


type CalendarNotificationOptions = {
  name: string;
  personalEmail: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  meetLink: string;
  action: "created" | "updated" | "cancelled";
};

export async function sendCalendarNotificationEmail(options: CalendarNotificationOptions) {
  if (!resend) throw new Error("RESEND_API_KEY is not configured");
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME || "EduOne Workspace";
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL is not configured");

  const safe = (value: string) => escapeHtml(value || "");
  const actionLabel = {
    created: "A new calendar event has been created",
    updated: "A calendar event has been updated",
    cancelled: "A calendar event has been cancelled",
  }[options.action];
  const start = options.start.toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const end = options.end.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" });
  const meet = options.meetLink
    ? `<p><a href="${safe(options.meetLink)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Join Google Meet</a></p>`
    : "";
  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [options.personalEmail],
    subject: `${actionLabel}: ${options.title}`,
    html: `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f4f6fa;padding:24px;color:#172033"><div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:28px"><h2 style="color:#1d4ed8">EduOne Workspace Calendar</h2><p>Hello ${safe(options.name)},</p><p>${actionLabel}.</p><h3>${safe(options.title)}</h3><p><b>Starts:</b> ${safe(start)}<br/><b>Ends:</b> ${safe(end)}</p>${options.description ? `<p>${safe(options.description)}</p>` : ""}${meet}<p style="font-size:12px;color:#64748b">You received this because you are an active EduOne Workspace member.</p></div></body></html>`,
    text: `Hello ${options.name},\n\n${actionLabel}.\n${options.title}\nStarts: ${start}\nEnds: ${end}\n${options.description}\n${options.meetLink ? `Join Google Meet: ${options.meetLink}` : ""}`,
  });
  if (error) throw new Error(error.message || "Calendar notification email failed");
  return data?.id;
}
