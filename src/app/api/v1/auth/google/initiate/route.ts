// GET & POST /api/v1/auth/google/initiate
// Initiates the Google OAuth 2.0 / OpenID Connect authorization code flow with PKCE.

import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthParams,
  setOAuthStateCookie,
  buildGoogleAuthUrl,
  getGoogleConfig,
} from "@/lib/google-auth";
import { ok, handler } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const returnUrl = url.searchParams.get("returnUrl") || "/";
  const prompt = url.searchParams.get("prompt") as "select_account" | "consent" | undefined;

  const { state, nonce, codeVerifier, codeChallenge } = generateOAuthParams();

  // Store OAuth state in secure, httpOnly cookie for CSRF and PKCE validation
  await setOAuthStateCookie({
    state,
    nonce,
    codeVerifier,
    returnUrl,
    createdAt: Date.now(),
  });

  const config = getGoogleConfig();
  const acceptHeader = req.headers.get("accept") || "";

  if (!config.clientId || !config.clientSecret) {
    // If request was initiated by browser navigation (e.g. window.location.href),
    // redirect gracefully to home/login with clear user feedback rather than raw JSON dump
    if (acceptHeader.includes("text/html") && !url.searchParams.get("format")) {
      const appBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        `${url.protocol}//${url.host}`;
      return NextResponse.redirect(
        `${appBaseUrl}/?auth_error=${encodeURIComponent(
          "Google Sign-In is not yet configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables."
        )}`
      );
    }

    // If Google OAuth credentials are not configured yet, return status
    return NextResponse.json(
      {
        ok: false,
        isConfigured: false,
        error: "Google OAuth is not configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables.",
        state,
      },
      { status: 503 }
    );
  }

  const authUrl = buildGoogleAuthUrl({
    state,
    nonce,
    codeChallenge,
    prompt,
  });

  // If request expects JSON (e.g. client fetch), return the URL
  if (acceptHeader.includes("application/json") || url.searchParams.get("format") === "json") {
    return NextResponse.json({ ok: true, isConfigured: true, authUrl, state });
  }

  // Otherwise, redirect the user directly to Google's consent screen
  return NextResponse.redirect(authUrl);
}

export const POST = handler(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const returnUrl = body.returnUrl || "/";
  const prompt = body.prompt;

  const { state, nonce, codeVerifier, codeChallenge } = generateOAuthParams();

  await setOAuthStateCookie({
    state,
    nonce,
    codeVerifier,
    returnUrl,
    createdAt: Date.now(),
  });

  const config = getGoogleConfig();

  if (!config.clientId) {
    return ok(
      {
        ok: false,
        isConfigured: false,
        error: "Google Client ID is not configured.",
        state,
      },
      503
    );
  }

  const authUrl = buildGoogleAuthUrl({
    state,
    nonce,
    codeChallenge,
    prompt,
  });

  return ok({
    ok: true,
    isConfigured: true,
    authUrl,
    state,
  });
});
