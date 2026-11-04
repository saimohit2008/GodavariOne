// Twilio SMS & Verify Adapter for Godavari One
// Supports official Twilio Verify API (preferred) with Twilio Messages API fallback.

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid?: string;
  fromNumber?: string;
}

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || "";
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.SMS_SENDER_ID || "";

  if (!accountSid.trim() || !authToken.trim()) {
    return null;
  }

  return {
    accountSid: accountSid.trim(),
    authToken: authToken.trim(),
    verifyServiceSid: verifyServiceSid.trim() || undefined,
    fromNumber: fromNumber.trim() || undefined,
  };
}

export function isTwilioConfigured(): boolean {
  return getTwilioConfig() !== null;
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) for 10-digit mobile numbers.
 */
export function normalizeToE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    return `+${digits}`;
  }
  // 10-digit Indian mobile number
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  // 11 digits starting with 0
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  // 12 digits starting with 91
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Extracts 10-digit national number for database records if needed
 */
export function toNationalPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export interface SendOtpResult {
  success: boolean;
  service: "verify" | "messages" | "unconfigured";
  sid?: string;
  error?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  approved: boolean;
  service: "verify" | "messages" | "unconfigured";
  error?: string;
}

/**
 * Sends a verification code via Twilio Verify (or Messages API if configured)
 */
export async function sendTwilioOtp(to: string, customMessage?: string): Promise<SendOtpResult> {
  const config = getTwilioConfig();
  if (!config) {
    return {
      success: false,
      service: "unconfigured",
      error: "Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.",
    };
  }

  const normalizedTo = normalizeToE164(to);
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;

  // 1. Prefer Twilio Verify if TWILIO_VERIFY_SERVICE_SID is configured
  if (config.verifyServiceSid) {
    try {
      const params = new URLSearchParams({
        To: normalizedTo,
        Channel: "sms",
      });

      const url = `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/Verifications`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let msg = data.message || `Twilio Verify error (HTTP ${res.status})`;
        if (data.code === 60200) msg = "Invalid phone number format for SMS delivery";
        if (data.code === 60203) msg = "Max send attempts reached for this phone number. Please try again later.";
        if (data.code === 21608) msg = "Twilio Trial restriction: Unverified recipient number. Caller ID verification required.";
        if (data.code === 20003) msg = "Twilio Authentication error: Invalid Account SID or Auth Token.";
        return { success: false, service: "verify", error: msg };
      }

      return {
        success: true,
        service: "verify",
        sid: data.sid,
      };
    } catch (err: any) {
      return {
        success: false,
        service: "verify",
        error: err instanceof Error ? err.message : "Network error contacting Twilio Verify",
      };
    }
  }

  // 2. Fallback to Twilio Messages API if fromNumber is provided
  if (config.fromNumber) {
    try {
      const messageBody = customMessage || "Your Godavari One verification code is requested. Valid for 5 minutes.";
      const params = new URLSearchParams({
        To: normalizedTo,
        From: config.fromNumber,
        Body: messageBody,
      });

      const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          service: "messages",
          error: data.message || `Twilio Messages error (HTTP ${res.status})`,
        };
      }

      return {
        success: true,
        service: "messages",
        sid: data.sid,
      };
    } catch (err: any) {
      return {
        success: false,
        service: "messages",
        error: err instanceof Error ? err.message : "Network error contacting Twilio Messages",
      };
    }
  }

  return {
    success: false,
    service: "unconfigured",
    error: "Twilio Verify service is not configured. Please set TWILIO_VERIFY_SERVICE_SID (or TWILIO_PHONE_NUMBER).",
  };
}

/**
 * Checks an entered code with Twilio Verify
 */
export async function checkTwilioVerifyCode(to: string, code: string): Promise<VerifyOtpResult> {
  const config = getTwilioConfig();
  if (!config || !config.verifyServiceSid) {
    return {
      success: false,
      approved: false,
      service: "unconfigured",
      error: "Twilio Verify service is not configured.",
    };
  }

  const normalizedTo = normalizeToE164(to);
  const authHeader = `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`;

  try {
    const params = new URLSearchParams({
      To: normalizedTo,
      Code: code.trim(),
    });

    const url = `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/VerificationCheck`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      let msg = data.message || `Twilio VerificationCheck error (HTTP ${res.status})`;
      if (data.code === 60202) msg = "Max verification attempts exceeded. Please request a new OTP.";
      return { success: false, approved: false, service: "verify", error: msg };
    }

    if (data.status === "approved") {
      return { success: true, approved: true, service: "verify" };
    }

    return {
      success: true,
      approved: false,
      service: "verify",
      error: "Incorrect verification code.",
    };
  } catch (err: any) {
    return {
      success: false,
      approved: false,
      service: "verify",
      error: err instanceof Error ? err.message : "Network error checking Twilio code",
    };
  }
}
