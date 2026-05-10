import "server-only";

import { prisma } from "@/lib/prisma";
import { isFixedSuperAdminEmail } from "@/lib/auth/super-admin";

export async function ensureRegistrationEmailAvailable(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      password_hash: true,
      accounts: {
        where: {
          providerId: "credential",
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (existingUser?.password_hash || (existingUser?.accounts.length ?? 0) > 0) {
    return {
      ok: false as const,
      error: "An account with this email already exists.",
    };
  }

  if (existingUser && !existingUser.password_hash) {
    return {
      ok: false as const,
      error:
        "This email already belongs to a legacy account. Add a password reset or reactivation flow before using the new credentials login.",
    };
  }

  return {
    ok: true as const,
    email: normalizedEmail,
  };
}

export async function createRegisteredUser(input: {
  email: string;
  fullName?: string | null;
  passwordHash: string;
  provider: "betterauth" | "nextauth";
}) {
  const now = new Date();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName?.trim() || null;
  const isSuperAdmin = isFixedSuperAdminEmail(email);

  if (input.provider === "betterauth") {
    const userId = crypto.randomUUID();

    await prisma.user.create({
      data: {
        id: userId,
        email,
        emailVerified: true,
        name: fullName,
        password_hash: input.passwordHash,
        is_active: true,
        is_super_admin: isSuperAdmin,
        created_at: now,
        updated_at: now,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            password: input.passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    });

    return;
  }

  await prisma.user.create({
    data: {
      email,
      emailVerified: true,
      name: fullName,
      password_hash: input.passwordHash,
      is_active: true,
      is_super_admin: isSuperAdmin,
      updated_at: now,
    },
  });
}
