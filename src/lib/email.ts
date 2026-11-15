import "server-only";

import { logger } from "@/lib/logger";
import type { EmailContent } from "@/lib/email-content";

/**
 * Email delivery.
 *
 * Two transports, because the right choice depends on how much you want to own:
 *
 *   * `knock`  — orchestration. Forge triggers a workflow by key; Knock owns
 *               templates, recipient preferences and unsubscribe handling. Good
 *               when non-engineers edit copy and when consent needs a real
 *               preference centre.
 *   * `resend` — direct send. One HTTP call, templates in code. Good when the
 *               copy lives in the repo and one provider is enough.
 *
 * Both are plain fetch calls, so there is no SDK and nothing to bundle. When no
 * key is configured, `sendEmail` reports `not_configured` and the caller must
 * skip the send rather than pretend it happened.
 */

export type EmailTransport = "knock" | "resend";

export type EmailRecipient = {
  /** Forge user id, used as the Knock recipient identity. */
  userId: string;
  email?: string | null;
};

const TIMEOUT_MS = 8000;

export function emailTransport(): EmailTransport | null {
  if (process.env.KNOCK_API_KEY) return "knock";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

export type SendResult =
  | { sent: true; transport: EmailTransport }
  | { sent: false; reason: "not_configured" | "provider_error" | "timeout" | "invalid_recipient" };

type SendInput = {
  recipient: EmailRecipient;
  workflow?: "weekly-summary" | "streak-warning";
  data?: Record<string, unknown>;
  content: EmailContent;
};

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const transport = emailTransport();

  if (!transport) {
    logger.warn("Email skipped: no email provider configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    if (transport === "knock") {
      const key = process.env.KNOCK_API_KEY;
      if (!key || !input.workflow) {
        return { sent: false, reason: "not_configured" };
      }

      const response = await fetch(
        `https://api.knock.app/v1/workflows/${input.workflow}/trigger`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            recipients: [input.recipient.userId],
            data: {
              ...input.data,
              subject: input.content.subject,
              html: input.content.html,
              text: input.content.text,
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        // Status and a code, never the address or the body.
        logger.warn("Knock trigger failed", { status: response.status, workflow: input.workflow });
        return { sent: false, reason: "provider_error" };
      }

      return { sent: true, transport };
    }

    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const to = input.recipient.email;

    if (!key || !from) return { sent: false, reason: "not_configured" };
    if (!to) return { sent: false, reason: "invalid_recipient" };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.content.subject,
        html: input.content.html,
        text: input.content.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("Resend send failed", { status: response.status });
      return { sent: false, reason: "provider_error" };
    }

    return { sent: true, transport };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "TimeoutError";
    logger.warn("Email send threw", { aborted });
    return { sent: false, reason: aborted ? "timeout" : "provider_error" };
  }
}
