import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

const REGISTER_OTP_PREFIX = "register-otp";
const REGISTER_OTP_TTL_MINUTES = 10;

type PendingRegistrationPayload = {
  email: string;
  fullName: string | null;
  passwordHash: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function encodePayload(payload: PendingRegistrationPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): PendingRegistrationPayload | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as PendingRegistrationPayload;

    if (!parsed.email || !parsed.passwordHash) {
      return null;
    }

    return {
      email: parsed.email.trim().toLowerCase(),
      fullName: parsed.fullName?.trim() || null,
      passwordHash: parsed.passwordHash,
    };
  } catch {
    return null;
  }
}

function getIdentifierPrefix(email: string) {
  return `${REGISTER_OTP_PREFIX}:${email.trim().toLowerCase()}:`;
}

function buildIdentifier(payload: PendingRegistrationPayload) {
  return `${getIdentifierPrefix(payload.email)}${encodePayload(payload)}`;
}

function extractPayloadFromIdentifier(identifier: string) {
  if (!identifier.startsWith(`${REGISTER_OTP_PREFIX}:`)) {
    return null;
  }

  const parts = identifier.split(":");

  if (parts.length < 3) {
    return null;
  }

  const encodedPayload = parts.slice(2).join(":");
  return decodePayload(encodedPayload);
}

export async function createRegistrationOtp(input: {
  email: string;
  fullName?: string | null;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const passwordHash = await bcrypt.hash(input.password, 12);
  const payload: PendingRegistrationPayload = {
    email,
    fullName: input.fullName?.trim() || null,
    passwordHash,
  };
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REGISTER_OTP_TTL_MINUTES * 60 * 1000);
  const identifierPrefix = getIdentifierPrefix(email);
  const identifier = buildIdentifier(payload);
  const tokenHash = hashToken(`${email}:${otp}`);

  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: {
        identifier: {
          startsWith: identifierPrefix,
        },
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
    email,
    otp,
    expiresInMinutes: REGISTER_OTP_TTL_MINUTES,
  };
}

export async function consumeRegistrationOtp(input: {
  email: string;
  otp: string;
}) {
  const email = input.email.trim().toLowerCase();
  const normalizedOtp = input.otp.trim();
  const tokenHash = hashToken(`${email}:${normalizedOtp}`);

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

  if (!verification) {
    return null;
  }

  const payload = extractPayloadFromIdentifier(verification.identifier);

  if (!payload || payload.email !== email) {
    return null;
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    await prisma.verification.delete({ where: { id: verification.id } }).catch(() => undefined);
    return { expired: true as const };
  }

  await prisma.verification.delete({ where: { id: verification.id } });

  return {
    expired: false as const,
    email: payload.email,
    fullName: payload.fullName,
    passwordHash: payload.passwordHash,
  };
}
