const HOSTINGER_API = "https://developers.hostinger.com/api/mail/v1";

export type CreateMailboxResult = {
  id: string;
  address: string;
  status: string;
};

function getConfig() {
  const token = process.env.HOSTINGER_API_TOKEN;
  const orderId = process.env.HOSTINGER_EMAIL_ORDER_ID;

  if (!token) throw new Error("HOSTINGER_API_TOKEN is not configured.");
  if (!orderId) throw new Error("HOSTINGER_EMAIL_ORDER_ID is not configured.");

  return { token, orderId };
}

async function request(
  path: string,
  method: "POST" | "DELETE",
  body?: Record<string, unknown>,
) {
  const { token } = getConfig();

  const response = await fetch(`${HOSTINGER_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        `Hostinger API request failed (${response.status}).`,
    );
  }

  return result?.data ?? result;
}

export async function createHostingerMailbox(
  localPart: string,
  password: string,
): Promise<CreateMailboxResult> {
  const { orderId } = getConfig();

  const normalized = localPart.trim().toLowerCase();
  const pattern = /^(?=[a-z0-9])(?=.*[a-z0-9]$)[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/;

  if (normalized.length > 50 || !pattern.test(normalized)) {
    throw new Error("Invalid company mailbox username.");
  }

  if (
    password.length < 8 ||
    password.length > 50 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      "Mailbox password must contain uppercase, lowercase, number and special character.",
    );
  }

  const mailbox = await request(
    `/orders/${encodeURIComponent(orderId)}/mailboxes`,
    "POST",
    {
      local_part: normalized,
      password,
    },
  );

  const id = mailbox?.id ?? mailbox?.resourceId;
  const address = mailbox?.address;

  if (!id || !address) {
    console.error("Unexpected Hostinger mailbox response:", {
      keys: mailbox ? Object.keys(mailbox) : [],
    });

    throw new Error(
      "Hostinger response did not contain the mailbox ID or address.",
    );
  }

  return {
    id: String(id),
    address: String(address),
    status: String(mailbox?.status ?? "active"),
  };
}

export async function deleteHostingerMailbox(mailboxId: string): Promise<void> {
  if (!mailboxId?.trim()) {
    throw new Error("Mailbox ID is required.");
  }

  await request(`/mailboxes/${encodeURIComponent(mailboxId.trim())}`, "DELETE");
}
