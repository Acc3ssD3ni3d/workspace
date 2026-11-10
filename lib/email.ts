import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const APP_URL = process.env.APP_URL;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const FROM_NAME = process.env.RESEND_FROM_NAME || "EduOne International";

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => {
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

function getAppUrl(path = ""): string {
  if (!APP_URL) {
    throw new Error("APP_URL is not configured");
  }

  let url: URL;

  try {
    url = new URL(APP_URL);
  } catch {
    throw new Error("APP_URL must be a valid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("APP_URL must use HTTP or HTTPS");
  }

  return new URL(
    path.replace(/^\/+/, ""),
    url.toString().replace(/\/?$/, "/"),
  ).toString();
}

function getResend() {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL is not configured");
  }

  return resend;
}

function getSender() {
  return `${FROM_NAME.replace(/[\r\n]/g, "")} <${FROM_EMAIL}>`;
}

function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>EduOne International Workspace</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f5f9;
  font-family:Arial,Helvetica,sans-serif;
  color:#172033;
">

  <table role="presentation" width="100%" cellspacing="0"
    cellpadding="0" border="0" style="background:#f3f5f9;padding:35px 12px;">

    <tr>
      <td align="center">

        <table role="presentation" width="100%" cellspacing="0"
          cellpadding="0" border="0"
          style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">

          <!-- BRAND HEADER -->
          <tr>
            <td style="
              background:#101827;
              padding:30px 36px;
            ">

              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <div style="
                      color:#ffffff;
                      font-size:23px;
                      font-weight:700;
                      letter-spacing:-0.5px;
                    ">
                      EduOne
                    </div>

                    <div style="
                      color:#94a3b8;
                      font-size:10px;
                      letter-spacing:3px;
                      margin-top:5px;
                    ">
                      INTERNATIONAL WORKSPACE
                    </div>
                  </td>

                  <td align="right" style="color:#60a5fa;font-size:12px;">
                    WORKSPACE
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- EMAIL CONTENT -->
          <tr>
            <td style="padding:38px 36px;">
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background:#f8fafc;
              padding:25px 36px;
              border-top:1px solid #e9edf3;
            ">

              <div style="
                font-size:13px;
                font-weight:700;
                color:#334155;
              ">
                EduOne International
              </div>

              <p style="
                margin:8px 0 0;
                font-size:12px;
                line-height:20px;
                color:#94a3b8;
              ">
                Empowering teams with a smarter workspace.
                <br />
                This is an automated email. Please do not reply.
              </p>

              <p style="
                margin:18px 0 0;
                font-size:11px;
                color:#a1aab8;
              ">
                © ${new Date().getFullYear()} EduOne International. All rights reserved.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
}

function primaryButton(url: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" bgcolor="#2563eb"
          style="border-radius:8px;">
          <a href="${escapeHtml(url)}"
            target="_blank"
            style="
              display:inline-block;
              padding:15px 27px;
              color:#ffffff;
              font-size:14px;
              font-weight:bold;
              text-decoration:none;
              border-radius:8px;
            ">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

type InvitationOptions = {
  name: string;
  personalEmail: string;
  companyEmail: string;
  temporaryPassword: string;
};

export async function sendEmployeeInvitation({
  name,
  personalEmail,
  companyEmail,
  temporaryPassword,
}: InvitationOptions) {
  const client = getResend();
  const loginUrl = getAppUrl("/login");

  const safeName = escapeHtml(name);
  const safeCompanyEmail = escapeHtml(companyEmail);
  const safePassword = escapeHtml(temporaryPassword);

  const html = emailLayout(`
    <div style="
      display:inline-block;
      padding:7px 12px;
      background:#eff6ff;
      color:#2563eb;
      border-radius:20px;
      font-size:11px;
      font-weight:bold;
      letter-spacing:1px;
      margin-bottom:22px;
    ">
      ACCOUNT INVITATION
    </div>

    <h1 style="
      margin:0 0 16px;
      font-size:28px;
      line-height:36px;
      color:#172033;
      letter-spacing:-0.7px;
    ">
      Welcome aboard, ${safeName}!
    </h1>

    <p style="
      font-size:15px;
      line-height:25px;
      color:#64748b;
      margin:0 0 25px;
    ">
      Your EduOne International Workspace account is ready.
      We're excited to have you as part of our team.
    </p>

    <div style="
      padding:23px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:12px;
      margin-bottom:25px;
    ">

      <p style="
        margin:0 0 9px;
        font-size:11px;
        font-weight:bold;
        color:#64748b;
        letter-spacing:1px;
      ">
        YOUR COMPANY EMAIL
      </p>

      <p style="
        margin:0 0 22px;
        font-size:15px;
        font-weight:600;
        color:#172033;
        word-break:break-word;
      ">
        ${safeCompanyEmail}
      </p>

      <div style="border-top:1px solid #e2e8f0;margin-bottom:20px;"></div>

      <p style="
        margin:0 0 9px;
        font-size:11px;
        font-weight:bold;
        color:#64748b;
        letter-spacing:1px;
      ">
        TEMPORARY PASSWORD
      </p>

      <p style="
        margin:0;
        font-size:16px;
        font-family:monospace;
        font-weight:bold;
        color:#172033;
        word-break:break-all;
      ">
        ${safePassword}
      </p>
    </div>

    ${primaryButton(loginUrl, "Open Your Workspace →")}

    <p style="
      margin:27px 0 0;
      font-size:13px;
      line-height:22px;
      color:#64748b;
    ">
      <strong style="color:#334155;">Important security reminder</strong>
      <br />
      Please sign in and change your temporary password immediately.
      Never share your login credentials with anyone.
    </p>
  `);

  const { data, error } = await client.emails.send({
    from: getSender(),
    to: [personalEmail],
    subject: "Welcome to EduOne International Workspace",
    html,
    text: `
Welcome to EduOne International, ${name}!

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

// ==========================================
// PASSWORD RESET EMAIL
// ==========================================

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
  const client = getResend();

  const safeResetUrl = escapeHtml(resetUrl);

  const html = emailLayout(`
    <div style="
      display:inline-block;
      padding:7px 12px;
      background:#eff6ff;
      color:#2563eb;
      border-radius:20px;
      font-size:11px;
      font-weight:bold;
      letter-spacing:1px;
      margin-bottom:22px;
    ">
      SECURITY NOTIFICATION
    </div>

    <h1 style="
      margin:0 0 16px;
      font-size:27px;
      line-height:36px;
      color:#172033;
    ">
      Reset your password
    </h1>

    <p style="
      font-size:15px;
      line-height:25px;
      color:#64748b;
    ">
      Hello ${escapeHtml(name)},
      <br /><br />
      We received a request to reset your EduOne Workspace password.
      Click the button below to create a new password.
    </p>

    ${primaryButton(resetUrl, "Reset My Password →")}

    <div style="
      margin-top:27px;
      padding:17px;
      background:#fff7ed;
      border:1px solid #fed7aa;
      border-radius:9px;
    ">
      <p style="
        margin:0;
        font-size:13px;
        line-height:22px;
        color:#9a3412;
      ">
        This link expires in 30 minutes and can only be used once.
      </p>
    </div>

    <p style="
      font-size:13px;
      line-height:22px;
      color:#64748b;
      margin-top:24px;
    ">
      If you didn't request a password reset, you can safely ignore
      this email. Your password will remain unchanged.
    </p>
  `);

  const { data, error } = await client.emails.send({
    from: getSender(),
    to: [personalEmail],
    subject: "Reset Your EduOne Workspace Password",
    html,
    text: `
Hello ${name},

We received a request to reset your EduOne Workspace password.

Reset your password using this link:
${resetUrl}

This link expires in 30 minutes and can only be used once.

If you did not request this, ignore this email.
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send password reset email");
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email ID");
  }

  return {
    emailId: data.id,
    sent: true,
  };
}

// ==========================================
// CALENDAR NOTIFICATION EMAIL
// ==========================================

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

export async function sendCalendarNotificationEmail(
  options: CalendarNotificationOptions,
) {
  const client = getResend();

  const actionLabels = {
    created: "A new calendar event has been created",
    updated: "A calendar event has been updated",
    cancelled: "A calendar event has been cancelled",
  };

  const actionLabel = actionLabels[options.action];

  const start = options.start.toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const end = options.end.toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const meetButton = options.meetLink
    ? primaryButton(options.meetLink, "Join Google Meet →")
    : "";

  const html = emailLayout(`
    <div style="
      display:inline-block;
      padding:7px 12px;
      background:#eff6ff;
      color:#2563eb;
      border-radius:20px;
      font-size:11px;
      font-weight:bold;
      letter-spacing:1px;
      margin-bottom:22px;
    ">
      CALENDAR NOTIFICATION
    </div>

    <h1 style="
      margin:0 0 15px;
      font-size:26px;
      line-height:35px;
      color:#172033;
    ">
      Calendar update
    </h1>

    <p style="
      font-size:15px;
      line-height:25px;
      color:#64748b;
    ">
      Hello ${escapeHtml(options.name)},
      <br /><br />
      ${escapeHtml(actionLabel)}.
      Here are the event details.
    </p>

    <div style="
      margin:24px 0;
      padding:23px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:12px;
    ">

      <h2 style="
        margin:0 0 20px;
        font-size:20px;
        color:#172033;
      ">
        ${escapeHtml(options.title)}
      </h2>

      <p style="
        margin:0 0 8px;
        font-size:11px;
        color:#64748b;
        font-weight:bold;
        letter-spacing:1px;
      ">
        STARTS
      </p>

      <p style="margin:0 0 20px;font-size:14px;color:#172033;">
        ${escapeHtml(start)}
      </p>

      <p style="
        margin:0 0 8px;
        font-size:11px;
        color:#64748b;
        font-weight:bold;
        letter-spacing:1px;
      ">
        ENDS
      </p>

      <p style="margin:0;font-size:14px;color:#172033;">
        ${escapeHtml(end)}
      </p>

      ${
        options.description
          ? `
            <div style="border-top:1px solid #e2e8f0;margin:20px 0;"></div>
            <p style="
              margin:0;
              font-size:13px;
              line-height:22px;
              color:#64748b;
              white-space:pre-wrap;
            ">
              ${escapeHtml(options.description)}
            </p>
          `
          : ""
      }
    </div>

    ${meetButton}

    <p style="
      margin-top:25px;
      font-size:12px;
      line-height:21px;
      color:#94a3b8;
    ">
      You received this notification because you are an active
      EduOne Workspace member.
    </p>
  `);

  const { data, error } = await client.emails.send({
    from: getSender(),
    to: [options.personalEmail],
    subject: `${actionLabel}: ${options.title}`,
    html,
    text: `
Hello ${options.name},

${actionLabel}.

Event: ${options.title}
Starts: ${start}
Ends: ${end}

${options.description || ""}

${options.meetLink ? `Join Google Meet: ${options.meetLink}` : ""}
    `,
  });

  if (error) {
    throw new Error(error.message || "Calendar notification email failed");
  }

  return data?.id;
}
