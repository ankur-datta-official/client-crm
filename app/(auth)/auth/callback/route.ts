import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

function normalizeInviteToken(token: string | null) {
  if (!token) {
    return null;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildInviteAcceptPath(inviteToken: string | null) {
  if (!inviteToken) {
    return null;
  }

  return `/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`;
}

function normalizeNextPath(next: string | null, inviteToken: string | null) {
  const invitePath = buildInviteAcceptPath(inviteToken);

  if (invitePath) {
    return invitePath;
  }

  if (!next || !next.startsWith("/")) {
    return "/dashboard";
  }

  return next;
}

function buildAuthErrorUrl(envAppUrl: string, nextPath: string, errorCode: string, errorDescription?: string | null) {
  const fallbackPath = nextPath.startsWith("/auth/accept-invite")
    ? nextPath
    : `/auth/login?next=${encodeURIComponent(nextPath)}`;
  const errorUrl = new URL(fallbackPath, envAppUrl);
  errorUrl.searchParams.set("auth_error", errorCode);

  if (errorDescription) {
    errorUrl.searchParams.set("auth_error_description", errorDescription);
  }

  return errorUrl;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const inviteToken = normalizeInviteToken(requestUrl.searchParams.get("invite_token"));
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"), inviteToken);
  const env = getSupabaseEnv();
  const redirectUrl = new URL(nextPath, env.appUrl);
  const loginUrl = new URL("/auth/login", env.appUrl);
  loginUrl.searchParams.set("next", nextPath);
  const providerError = requestUrl.searchParams.get("error");
  const providerErrorDescription = requestUrl.searchParams.get("error_description");

  if (providerError) {
    return NextResponse.redirect(
      buildAuthErrorUrl(env.appUrl, nextPath, providerError, providerErrorDescription),
    );
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.redirect(
      buildAuthErrorUrl(env.appUrl, nextPath, "auth_callback_failed", error.message),
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (!error) {
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.redirect(
      buildAuthErrorUrl(env.appUrl, nextPath, "auth_callback_failed", error.message),
    );
  }

  loginUrl.searchParams.set("error", "auth_callback_missing_token");
  return NextResponse.redirect(loginUrl);
}
