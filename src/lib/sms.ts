// Real SMS Delivery Adapter for Godavari One
// Integrates with Twilio and configured SMS gateways.

import { sendTwilioOtp, normalizeToE164, getTwilioConfig } from "./twilio";

export { normalizeToE164, toNationalPhone } from "./twilio";
export const normalizePhoneNumber = normalizeToE164;

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendSms(options: { to: string; message: string }): Promise<SendSmsResult> {
  const provider = (process.env.SMS_PROVIDER || "").toLowerCase().trim();
  const twilioConfig = getTwilioConfig();

  // If Twilio is configured, or SMS_PROVIDER is set to twilio, use Twilio
  if (twilioConfig || provider === "twilio") {
    if (!twilioConfig) {
      return {
        success: false,
        error: "Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      };
    }
    const result = await sendTwilioOtp(options.to, options.message);
    return {
      success: result.success,
      messageId: result.sid,
      error: result.error,
    };
  }

  const apiKey = process.env.SMS_API_KEY || "";
  const senderId = process.env.SMS_SENDER_ID || "GODAVARI";
  const normalizedTo = normalizeToE164(options.to);

  if (!provider || !apiKey) {
    return {
      success: false,
      error: "SMS provider credentials are not configured in environment variables (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN or SMS_PROVIDER / SMS_API_KEY).",
    };
  }

  try {
    if (provider === "fast2sms") {
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: options.message,
          numbers: options.to.replace(/\D/g, "").slice(-10),
        }),
      });

      if (!res.ok) {
        return { success: false, error: `Fast2SMS delivery failed with status ${res.status}` };
      }

      const data = await res.json().catch(() => ({}));
      return { success: !!data.return, messageId: data.request_id };
    }

    if (provider === "webhook" || provider === "https") {
      const endpoint = process.env.SMS_ENDPOINT;
      if (!endpoint) {
        return { success: false, error: "SMS_ENDPOINT must be configured for webhook provider." };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: normalizedTo,
          message: options.message,
          senderId,
        }),
      });

      if (!res.ok) {
        return { success: false, error: `SMS gateway responded with HTTP ${res.status}` };
      }

      return { success: true };
    }

    return {
      success: false,
      error: `Unsupported SMS_PROVIDER "${provider}". Supported: twilio, fast2sms, webhook.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error during SMS dispatch",
    };
  }
}
