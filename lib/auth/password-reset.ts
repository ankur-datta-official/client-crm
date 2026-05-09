import "server-only";

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const PASSWORD_RESET_PREFIX = "password-reset";
const PASSWORD_RESET_TTL_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getUserIdentifier(userId: string) {
  return `${PASSWORD_RESET_PREFIX}:${userId}`;
}

export function resolveAppBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.BETTER_AUTH_URL
    ?? process.env.NEXTAUTH_URL
    ?? "http://localhost:3000";

  const trimmed = raw.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, "");
  }

  return `https://${trimmed.replace(/\/$/, "")}`;
}

export async function createPasswordResetToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      is_active: true,
    },
  });

  if (!user || !user.is_active) {
    return null;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  const identifier = getUserIdentifier(user.id);

  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: {
        identifier,
      },
    }),
    prisma.verification.create({
      data: {
        id: crypto.randomUUID(),
        identifier,
        value: tokenHash,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      },
    }),
  ]);

  return {
    user,
    rawToken,
  };
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = hashToken(token);

  const verification = await prisma.verification.findUnique({
    where: {
      value: tokenHash,
    },
    select: {
      id: true,
      identifier: true,
      expiresAt: true,
    },
  });

  if (!verification || !verification.identifier.startsWith(`${PASSWORD_RESET_PREFIX}:`)) {
    return null;
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    await prisma.verification.delete({ where: { id: verification.id } }).catch(() => undefined);
    return null;
  }

  const userId = verification.identifier.slice(`${PASSWORD_RESET_PREFIX}:`.length);
  await prisma.verification.delete({ where: { id: verification.id } });

  if (!userId) {
    return null;
  }

  return {
    userId,
  };
}