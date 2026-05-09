import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Missing reset token."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const tokenState = await consumePasswordResetToken(parsed.data.token);

  if (!tokenState) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired. Please request a new one." },
      { status: 400 },
    );
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: {
        id: tokenState.userId,
      },
      data: {
        password_hash: passwordHash,
        updated_at: now,
      },
    });

    const credentialAccount = await tx.account.findFirst({
      where: {
        userId: tokenState.userId,
        providerId: "credential",
      },
      select: {
        id: true,
      },
    });

    if (credentialAccount) {
      await tx.account.update({
        where: {
          id: credentialAccount.id,
        },
        data: {
          password: passwordHash,
          updatedAt: now,
        },
      });
    } else {
      await tx.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: tokenState.userId,
          accountId: tokenState.userId,
          providerId: "credential",
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}