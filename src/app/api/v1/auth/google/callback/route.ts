// GET /api/v1/auth/google/callback
// Handles Google OAuth 2.0 / OpenID Connect redirect callback.
// Validates state, nonce, PKCE code verifier, and ID token before session creation.

import { NextRequest, NextResponse } from "next/server";
import {
  getAndClearOAuthStateCookie,
  exchangeGoogleCodeForTokens,
  verifyGoogleIdToken,
  resolveGoogleUser,
} from "@/lib/google-auth";
import { getCurrentUser } from "@/lib/auth";
import { getClientIp } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const appBaseUrl =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `${url.protocol}//${url.host}`;

  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Handle user cancelled authentication or Google denial
  if (errorParam) {
    console.warn(`[GoogleAuth] Authentication cancelled or failed with error: ${errorParam}`);
    return NextResponse.redirect(
      `${appBaseUrl}/?auth_error=${encodeURIComponent(
        errorParam === "access_denied" ? "Google sign-in was cancelled." : `Google error: ${errorParam}`
      )}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appBaseUrl}/?auth_error=${encodeURIComponent("Missing authorization code or state parameter.")}`);
  }

  // 1. Validate state parameter from httpOnly cookie
  const storedState = await getAndClearOAuthStateCookie(req);
  if (!storedState || storedState.state !== state) {
    return NextResponse.redirect(
      `${appBaseUrl}/?auth_error=${encodeURIComponent("Invalid or expired OAuth state session. Please try again.")}`
    );
  }

  const returnUrl = storedState.returnUrl || "/";

  try {
    // 2. Exchange authorization code for tokens using PKCE code_verifier
    const { idToken } = await exchangeGoogleCodeForTokens({
      code,
      codeVerifier: storedState.codeVerifier,
    });

    // 3. Cryptographically verify Google ID token and validate nonce
    const identity = await verifyGoogleIdToken(idToken, storedState.nonce);

    // 4. Resolve user identity and enforce account linking security
    const currentUserCtx = await getCurrentUser(req);
    const ip = getClientIp(req);

    const result = await resolveGoogleUser(identity, {
      currentUserId: currentUserCtx?.user.id,
      ip,
    });

    if (result.status === "ERROR") {
      return NextResponse.redirect(`${appBaseUrl}/?auth_error=${encodeURIComponent(result.error)}`);
    }

    if (result.status === "LINKING_REQUIRED") {
      // Account takeover defense: direct user to log in first and link explicitly
      return NextResponse.redirect(
        `${appBaseUrl}/?link_required=true&email=${encodeURIComponent(result.existingEmail)}`
      );
    }

    // Success: redirect to intended return destination
    const destination = returnUrl.startsWith("/") ? `${appBaseUrl}${returnUrl}` : returnUrl;
    return NextResponse.redirect(destination);
  } catch (err: any) {
    console.error("[GoogleAuth] Callback error:", err);
    return NextResponse.redirect(
      `${appBaseUrl}/?auth_error=${encodeURIComponent(err.message || "Authentication failed. Please try again.")}`
    );
  }
}
