import { type NextRequest, NextResponse } from "next/server";

function normalizeInviteToken(token: string | null) {
  if (!token) {
    return null;
  }

  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeAppUrl(rawUrl?: string | null) {
  const value = rawUrl?.trim();

  if (!value) {
    return "http://localhost:3000";
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/$/, "");
  }

  if (value.startsWith("localhost") || value.startsWith("127.0.0.1")) {
    return `http://${value.replace(/\/$/, "")}`;
  }

  return `https://${value.replace(/\/$/, "")}`;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const appUrl = normalizeAppUrl(
    process.env.BETTER_AUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.NEXTAUTH_URL,
  );
  const inviteToken = normalizeInviteToken(
    requestUrl.searchParams.get("invite_token") ?? requestUrl.searchParams.get("token"),
  );

  if (inviteToken) {
    const inviteUrl = new URL("/auth/accept-invite", appUrl);
    inviteUrl.searchParams.set("token", inviteToken);
    return NextResponse.redirect(inviteUrl);
  }

  const loginUrl = new URL("/auth/login", appUrl);
  loginUrl.searchParams.set("auth_error", "legacy_callback_disabled");
  return NextResponse.redirect(loginUrl);
}
