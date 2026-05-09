import "server-only";

import { sendTransactionalEmail } from "@/lib/email/smtp";

export async function sendRegistrationOtpEmail(input: {
  email: string;
  otp: string;
  fullName?: string | null;
  expiresInMinutes: number;
}) {
  const recipientName = input.fullName?.trim() || "there";

  await sendTransactionalEmail({
    to: input.email,
    subject: "Your CRM account verification code",
    text: [
      `Hello ${recipientName},`,
      "",
      `Your CRM verification code is ${input.otp}.`,
      `Enter this code within ${input.expiresInMinutes} minutes to finish creating your account.`,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hello ${recipientName},</p>
      <p>Your CRM verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.35em;margin:18px 0;">${input.otp}</p>
      <p>Enter this code within ${input.expiresInMinutes} minutes to finish creating your account.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}
