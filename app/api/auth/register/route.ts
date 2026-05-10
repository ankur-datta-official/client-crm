import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSignupRequest,
  markSignupRequestCompleted,
  validateSignupPasskey,
} from "@/lib/auth/access-requests";
import { createRegisteredUser, ensureRegistrationEmailAvailable } from "@/lib/auth/register";
import { getAuthProvider } from "@/lib/auth/provider";

const registerSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
});

const verifyPasskeySchema = z.object({
  email: z.string().email("Enter a valid work email."),
  passkey: z.string().trim().min(6, "Enter the access passkey."),
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

  try {
    const result = await createSignupRequest({
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
    });

    return NextResponse.json({
      ok: true,
      requiresApproval: true,
      email: result.email,
      message: result.message,
    });
  } catch (error) {
    console.error("Failed to submit signup request:", error);
    const message = error instanceof Error ? error.message : "We could not submit your access request right now.";
    const status = message.toLowerCase().includes("account") || message.toLowerCase().includes("email") ? 409 : 500;
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}

export async function PATCH(request: Request) {
  const provider = getAuthProvider();
  const body = await request.json().catch(() => null);
  const parsed = verifyPasskeySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid access passkey request." },
      { status: 400 },
    );
  }

  const availability = await ensureRegistrationEmailAvailable(parsed.data.email);

  if (!availability.ok) {
    return NextResponse.json({ error: availability.error }, { status: 409 });
  }

  let verification: Awaited<ReturnType<typeof validateSignupPasskey>>;

  try {
    verification = await validateSignupPasskey({
      email: availability.email,
      passkey: parsed.data.passkey,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not validate the access passkey." },
      { status: 400 },
    );
  }

  try {
    await createRegisteredUser({
      email: availability.email,
      fullName: verification.full_name,
      passwordHash: verification.password_hash,
      provider,
    });
    await markSignupRequestCompleted({
      requestId: verification.request_id,
      passkeyId: verification.passkey_id,
    });
  } catch (error) {
    console.error("Failed to complete approved registration:", error);
    return NextResponse.json(
      { error: "We could not finish creating your account. Ask the administrator for a fresh passkey and try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
