// Real Email Delivery Adapter for Godavari One
// Integrates with official Resend API and configured email delivery providers.

import { getResendConfig } from "./resend";

export {
  sendEmailVerification,
  validateEmailVerificationToken,
  generateVerificationCode,
  generateVerificationToken,
  hashVerificationToken,
  isResendConfigured,
  getResendConfig,
} from "./resend";

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  const resendConfig = getResendConfig();

  // If Resend is configured, or EMAIL_PROVIDER is set to resend, use Resend
  if (resendConfig || provider === "resend") {
    if (!resendConfig) {
      return {
        success: false,
        error: "Resend credentials are not configured. Please set RESEND_API_KEY in environment variables.",
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendConfig.from,
          to: [options.to.toLowerCase().trim()],
          subject: options.subject,
          text: options.text,
          html: options.html || options.text,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = data.message || `Resend delivery failed with status ${res.status}`;
        if (res.status === 401) msg = "Invalid Resend API Key. Check RESEND_API_KEY.";
        if (res.status === 403) msg = "Resend domain not verified or sender restricted. Check EMAIL_FROM.";
        return { success: false, error: msg };
      }

      return { success: true, messageId: data.id };
    } catch (err: any) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error contacting Resend API",
      };
    }
  }

  const apiKey = process.env.EMAIL_API_KEY || "";
  const from = process.env.EMAIL_FROM || "Godavari One <noreply@godavarione.in>";

  if (!provider || !apiKey) {
    return {
      success: false,
      error: "Email provider credentials are not configured in environment variables (RESEND_API_KEY or EMAIL_PROVIDER / EMAIL_API_KEY).",
    };
  }

  try {
    if (provider === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: from.includes("<") ? from.split("<")[1].replace(">", "") : from },
          subject: options.subject,
          content: [
            { type: "text/plain", value: options.text },
            ...(options.html ? [{ type: "text/html", value: options.html }] : []),
          ],
        }),
      });

      if (!res.ok) {
        return { success: false, error: `SendGrid responded with HTTP ${res.status}` };
      }

      return { success: true };
    }

    if (provider === "webhook" || provider === "https") {
      const endpoint = process.env.EMAIL_ENDPOINT;
      if (!endpoint) {
        return { success: false, error: "EMAIL_ENDPOINT must be configured for webhook provider." };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: options.to,
          from,
          subject: options.subject,
          text: options.text,
          html: options.html,
        }),
      });

      if (!res.ok) {
        return { success: false, error: `Email gateway responded with HTTP ${res.status}` };
      }

      return { success: true };
    }

    return {
      success: false,
      error: `Unsupported EMAIL_PROVIDER "${provider}". Supported: resend, sendgrid, webhook.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error during email dispatch",
    };
  }
}
