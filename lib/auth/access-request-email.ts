import "server-only";

import { getSmtpAvailability, sendTransactionalEmail } from "@/lib/email/smtp";

type SuperAdminRecipient = {
  email: string;
  fullName: string | null;
};

function normalizeAppUrl(rawUrl?: string | null) {
  const value = rawUrl?.trim();

  if (!value) {
    return "http://localhost:3000";
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/$/, "");
  }

  if (value.startsWith("localhost") || value.startsWith("127.0.0.1")) {
    return `http://${value.replace(/\/$/, "")}`;
  }

  return `https://${value.replace(/\/$/, "")}`;
}

function buildRegistrationAccessUrl(email: string, passkey: string) {
  const appUrl = normalizeAppUrl(
    process.env.BETTER_AUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.NEXTAUTH_URL,
  );

  const registerUrl = new URL("/auth/register", appUrl);
  registerUrl.searchParams.set("email", email.trim().toLowerCase());
  registerUrl.searchParams.set("passkey", passkey.trim().toUpperCase());
  registerUrl.searchParams.set("access", "1");
  return registerUrl.toString();
}

export async function sendSignupRequestSubmittedEmails(input: {
  recipients: SuperAdminRecipient[];
  requesterEmail: string;
  requesterName?: string | null;
  requestedAt: Date;
}) {
  const smtp = getSmtpAvailability();

  if (!smtp.ok || input.recipients.length === 0) {
    return { ok: false as const, reason: smtp.ok ? "No super admin recipients configured." : smtp.reason };
  }

  await Promise.all(
    input.recipients.map((recipient) =>
      sendTransactionalEmail({
        to: recipient.email,
        subject: "New CRM signup request pending review",
        text: [
          `Hello ${recipient.fullName?.trim() || "Admin"},`,
          "",
          "A new CRM account access request has been submitted.",
          `Requester: ${input.requesterName?.trim() || "Unknown requester"}`,
          `Email: ${input.requesterEmail}`,
          `Requested at: ${input.requestedAt.toISOString()}`,
          "",
          "Open the Access Requests admin screen to review and issue a one-time access passkey.",
        ].join("\n"),
        html: `
          <p>Hello ${recipient.fullName?.trim() || "Admin"},</p>
          <p>A new CRM account access request has been submitted.</p>
          <p><strong>Requester:</strong> ${input.requesterName?.trim() || "Unknown requester"}<br />
          <strong>Email:</strong> ${input.requesterEmail}<br />
          <strong>Requested at:</strong> ${input.requestedAt.toISOString()}</p>
          <p>Open the Access Requests admin screen to review and issue a one-time access passkey.</p>
        `,
      }),
    ),
  );

  return { ok: true as const };
}

export async function sendAccessPasskeyIssuedEmail(input: {
  email: string;
  fullName?: string | null;
  passkey: string;
  expiresAt: Date;
}) {
  const smtp = getSmtpAvailability();

  if (!smtp.ok) {
    return { ok: false as const, reason: smtp.reason };
  }

  const recipientName = input.fullName?.trim() || "there";
  const accessUrl = buildRegistrationAccessUrl(input.email, input.passkey);

  await sendTransactionalEmail({
    to: input.email,
    subject: "Your CRM account access passkey",
    text: [
      `Hello ${recipientName},`,
      "",
      "Your CRM signup request has been approved.",
      `One-click access link: ${accessUrl}`,
      "",
      `Access passkey: ${input.passkey}`,
      `Expires at: ${input.expiresAt.toISOString()}`,
      "",
      "Open the secure access link above to complete your registration automatically.",
      "If you prefer, you can still open the registration page manually, enter this passkey, and finish creating your account.",
      "This passkey can only be used once.",
    ].join("\n"),
    html: `
      <p>Hello ${recipientName},</p>
      <p>Your CRM signup request has been approved.</p>
      <p>
        <a href="${accessUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;text-decoration:none;font-weight:700;">
          Complete registration instantly
        </a>
      </p>
      <p>Click the secure access link above to finish creating your account automatically.</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.22em;margin:18px 0;">${input.passkey}</p>
      <p><strong>Expires at:</strong> ${input.expiresAt.toISOString()}</p>
      <p>If you prefer a manual fallback, go back to the registration page, enter this passkey, and complete your account creation.</p>
      <p>This passkey can only be used once.</p>
      <p>If the button does not work, copy and paste this secure access link into your browser:</p>
      <p><a href="${accessUrl}">${accessUrl}</a></p>
    `,
  });

  return { ok: true as const };
}
