import { NextResponse } from "next/server";
import { z } from "zod";
import { createRegisteredUser, ensureRegistrationEmailAvailable } from "@/lib/auth/register";
import { consumeRegistrationOtp, createRegistrationOtp } from "@/lib/auth/register-otp";
import { sendRegistrationOtpEmail } from "@/lib/auth/register-otp-email";
import { getAuthProvider } from "@/lib/auth/provider";
import { getSmtpAvailability } from "@/lib/email/smtp";

const registerSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
});

const verifyOtpSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid registration payload." },
      { status: 400 },
    );
  }

  const availability = await ensureRegistrationEmailAvailable(parsed.data.email);

  if (!availability.ok) {
    return NextResponse.json({ error: availability.error }, { status: 409 });
  }

  try {
    const otpPayload = await createRegistrationOtp({
      email: availability.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
    });

    const smtp = getSmtpAvailability();

    if (!smtp.ok) {
      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          ok: true,
          requiresOtp: true,
          devOtp: otpPayload.otp,
          message: "SMTP is not configured locally, so the verification code is shown below for development testing.",
        });
      }

      return NextResponse.json(
        { error: "Email delivery is not configured yet. Set SMTP credentials before enabling signup verification." },
        { status: 500 },
      );
    }

    await sendRegistrationOtpEmail({
      email: otpPayload.email,
      otp: otpPayload.otp,
      fullName: parsed.data.fullName,
      expiresInMinutes: otpPayload.expiresInMinutes,
    });
  } catch (error) {
    console.error("Failed to issue registration OTP:", error);
    return NextResponse.json(
      { error: "We could not send the verification code right now. Please try again shortly." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    requiresOtp: true,
    message: "We sent a 6-digit verification code to your work email.",
  });
}

export async function PATCH(request: Request) {
  const provider = getAuthProvider();
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid verification request." },
      { status: 400 },
    );
  }

  const availability = await ensureRegistrationEmailAvailable(parsed.data.email);

  if (!availability.ok) {
    return NextResponse.json({ error: availability.error }, { status: 409 });
  }

  const verification = await consumeRegistrationOtp({
    email: availability.email,
    otp: parsed.data.otp,
  });

  if (!verification) {
    return NextResponse.json(
      { error: "The verification code is invalid. Please check the code and try again." },
      { status: 400 },
    );
  }

  if (verification.expired) {
    return NextResponse.json(
      { error: "This verification code has expired. Request a new code to continue." },
      { status: 400 },
    );
  }

  try {
    await createRegisteredUser({
      email: verification.email,
      fullName: verification.fullName,
      passwordHash: verification.passwordHash,
      provider,
    });
  } catch (error) {
    console.error("Failed to complete verified registration:", error);
    return NextResponse.json(
      { error: "We could not finish creating your account. Please request a new code and try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
