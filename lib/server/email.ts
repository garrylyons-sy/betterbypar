type EmailPayload = {
  to: string;
  idempotencyKey?: string;
  bcc?: string | string[];
  subject: string;
  html: string;
  text: string;
};

type EmailResult = {
  status: "Sent" | "Queued" | "Failed";
  providerId?: string;
  error?: string;
};

export async function sendAppEmail(payload: EmailPayload): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.INVITE_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      status: "Queued",
      error: "Email provider is not configured. Set RESEND_API_KEY and INVITE_FROM_EMAIL."
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(payload.idempotencyKey ? {"Idempotency-Key":payload.idempotencyKey} : {})
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from,
        to: payload.to,
        ...(payload.bcc ? { bcc: payload.bcc } : {}),
        subject: payload.subject,
        html: payload.html,
        text: payload.text
      })
    });
  } catch (error) {
    return {
      status: "Failed",
      error: error instanceof Error ? error.message : "Email provider is unavailable."
    };
  }
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      status: "Failed",
      error: typeof data?.message === "string" ? data.message : "Email provider rejected the message."
    };
  }

  return {
    status: "Sent",
    providerId: typeof data?.id === "string" ? data.id : undefined
  };
}

export function appBaseUrl(requestUrl?: string) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (requestUrl) return new URL("/", requestUrl).origin;
  return "http://localhost:3500";
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
