import "server-only";

import { sendTransactionalEmail } from "@/lib/email/smtp";

type SendTeamInviteEmailInput = {
  email: string;
  token: string;
  fullName?: string | null;
  organizationName: string;
  roleName?: string | null;
  expiresAt?: Date | string | null;
};

export type InviteEmailDelivery =
  | { ok: true; method: "smtp_invite" }
  | { ok: false; reason: string };

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

function buildInviteAcceptUrl(token: string) {
  const appUrl = normalizeAppUrl(
    process.env.BETTER_AUTH_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.NEXTAUTH_URL,
  );

  const inviteUrl = new URL("/auth/accept-invite", appUrl);
  inviteUrl.searchParams.set("token", token);
  return inviteUrl.toString();
}

function buildInviteEmailContent(input: SendTeamInviteEmailInput) {
  const inviteUrl = buildInviteAcceptUrl(input.token);
  const inviteeName = input.fullName?.trim() || "there";
  const expiresAtLabel = input.expiresAt
    ? new Date(input.expiresAt).toLocaleString()
    : null;
  const roleLine = input.roleName ? `Your invited role: ${input.roleName}` : null;
  const expiryLine = expiresAtLabel ? `Invitation expires: ${expiresAtLabel}` : null;

  return {
    inviteUrl,
    subject: `You're invited to join ${input.organizationName}`,
    text: [
      `Hello ${inviteeName},`,
      "",
      `You have been invited to join ${input.organizationName}.`,
      roleLine,
      expiryLine,
      `Open this secure invite link to review the invitation, sign in, and accept access: ${inviteUrl}`,
      "",
      "If you already have an account, sign in with the same email address that received this invite.",
    ].filter((line): line is string => Boolean(line)).join("\n"),
    html: `
      <p>Hello ${inviteeName},</p>
      <p>You have been invited to join <strong>${input.organizationName}</strong>.</p>
      ${input.roleName ? `<p><strong>Invited role:</strong> ${input.roleName}</p>` : ""}
      ${expiresAtLabel ? `<p><strong>Invitation expires:</strong> ${expiresAtLabel}</p>` : ""}
      <p>
        <a href="${inviteUrl}">Review and accept your invitation</a>
      </p>
      <p>If you already have an account, sign in with the same email address that received this invite.</p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    `,
  };
}

export async function sendTeamInviteEmail(input: SendTeamInviteEmailInput): Promise<InviteEmailDelivery> {
  const content = buildInviteEmailContent(input);

  try {
    await sendTransactionalEmail({
      to: input.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    return { ok: true, method: "smtp_invite" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Invitation email could not be sent.",
    };
  }
}
