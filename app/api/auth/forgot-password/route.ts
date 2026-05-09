import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetToken, resolveAppBaseUrl } from "@/lib/auth/password-reset";
import { sendTransactionalEmail } from "@/lib/email/smtp";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid work email."),
});

const GENERIC_RESPONSE_MESSAGE = "If an account exists for this email, a password reset link has been sent.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const tokenPayload = await createPasswordResetToken(parsed.data.email);

  if (!tokenPayload) {
    return NextResponse.json({ ok: true, message: GENERIC_RESPONSE_MESSAGE });
  }

  try {
    const appBaseUrl = resolveAppBaseUrl();
    const resetUrl = `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(tokenPayload.rawToken)}`;

    await sendTransactionalEmail({
      to: tokenPayload.user.email,
      subject: "Reset your CRM password",
      text: `We received a request to reset your password. Use this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>We received a request to reset your password.</p><p><a href="${resetUrl}">Reset password</a> (valid for 30 minutes).</p><p>If you did not request this, you can ignore this email.</p>`,
    });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }

  return NextResponse.json({ ok: true, message: GENERIC_RESPONSE_MESSAGE });
}
