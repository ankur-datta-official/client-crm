"use client";

import { createAuthClient } from "better-auth/react";

function normalizeClientBaseUrl(rawUrl?: string) {
  const value = rawUrl?.trim();

  if (!value) {
    return "http://localhost:3000";
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/$/, "");
  }

  return `https://${value.replace(/\/$/, "")}`;
}

export const authClient = createAuthClient({
  baseURL: `${normalizeClientBaseUrl(process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL)}/api/better-auth`,
});
