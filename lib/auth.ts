import "server-only";

import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

function normalizeBaseUrl(rawUrl?: string | null) {
  const value = rawUrl?.trim();

  if (!value) {
    return "http://localhost:3000";
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/$/, "");
  }

  return `https://${value.replace(/\/$/, "")}`;
}

export const BETTER_AUTH_BASE_PATH = "/api/better-auth";
export const BETTER_AUTH_BASE_URL = normalizeBaseUrl(
  process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
);
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET
  ?? process.env.AUTH_SECRET
  ?? "local-development-only-better-auth-secret-change-me";

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_BASE_URL,
  basePath: BETTER_AUTH_BASE_PATH,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
    usePlural: false,
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    password: {
      hash: async (password) => bcrypt.hash(password, 12),
      verify: async ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  user: {
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "emailVerified",
    },
  },
  session: {
    fields: {
      expiresAt: "expiresAt",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      ipAddress: "ipAddress",
      userAgent: "userAgent",
    },
  },
  account: {
    fields: {
      accountId: "accountId",
      providerId: "providerId",
      accessToken: "accessToken",
      refreshToken: "refreshToken",
      accessTokenExpiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      idToken: "idToken",
      password: "password",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  verification: {
    fields: {
      expiresAt: "expiresAt",
      value: "value",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  experimental: {
    joins: true,
  },
  plugins: [nextCookies()],
});
