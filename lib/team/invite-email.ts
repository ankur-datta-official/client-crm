import "server-only";

import { sendTransactionalEmail } from "@/lib/email/smtp";
import { formatDateTimeBD } from "@/lib/format/datetime";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  const inviteHostname = new URL(inviteUrl).hostname;
  const inviteeName = input.fullName?.trim() || "there";
  const expiresAtLabel = input.expiresAt
    ? formatDateTimeBD(input.expiresAt)
    : null;
  const roleLine = input.roleName ? `Your invited role: ${input.roleName}` : null;
  const expiryLine = expiresAtLabel ? `Invitation expires: ${expiresAtLabel}` : null;
  const safeInviteeName = escapeHtml(inviteeName);
  const safeOrganizationName = escapeHtml(input.organizationName);
  const safeRoleName = input.roleName ? escapeHtml(input.roleName) : null;
  const safeExpiresAtLabel = expiresAtLabel ? escapeHtml(expiresAtLabel) : null;
  const safeInviteUrl = escapeHtml(inviteUrl);
  const safeInviteHostname = escapeHtml(inviteHostname);

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
      <div style="margin:0;padding:32px 16px;background-color:#f5f7fb;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 auto;max-width:620px;">
          <tr>
            <td style="padding:0 0 20px 0;text-align:center;font-family:Arial,sans-serif;">
              <div style="display:inline-block;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#0f172a;">
                Client CRM
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:0;box-shadow:0 18px 40px rgba(15,23,42,0.06);">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:36px 36px 28px 36px;font-family:Arial,sans-serif;color:#0f172a;border-bottom:1px solid #eef2f7;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#0f766e;">
                      Team Invitation
                    </div>
                    <h1 style="margin:14px 0 10px 0;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:#0f172a;">
                      You're invited to join ${safeOrganizationName}
                    </h1>
                    <p style="margin:0;max-width:470px;font-size:15px;line-height:1.75;color:#475569;">
                      Hello ${safeInviteeName}, you have been invited to access your workspace. Review the details below and accept the invitation to get started.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 36px 20px 36px;font-family:Arial,sans-serif;color:#0f172a;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0 12px;">
                      <tr>
                        <td style="width:50%;padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;vertical-align:top;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Workspace</div>
                          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#0f172a;">${safeOrganizationName}</div>
                        </td>
                        <td style="width:50%;padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;vertical-align:top;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Role</div>
                          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#0f172a;">${safeRoleName ?? "Team access"}</div>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;vertical-align:top;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Invitation expires</div>
                          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#0f172a;">${safeExpiresAtLabel ?? "Use this invite as soon as possible."}</div>
                        </td>
                      </tr>
                    </table>

                    <div style="padding:18px 0 6px 0;">
                      <a
                        href="${safeInviteUrl}"
                        style="display:inline-block;padding:14px 22px;border-radius:14px;background:#0f766e;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;"
                      >
                        Review and accept invitation
                      </a>
                    </div>

                    <p style="margin:16px 0 0 0;font-size:14px;line-height:1.75;color:#475569;">
                      If you already have an account, sign in using the same email address that received this invitation.
                    </p>

                    <div style="margin-top:22px;padding:18px;border-radius:16px;background:#fafbfc;border:1px solid #e2e8f0;">
                      <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Secure fallback link</div>
                      <p style="margin:10px 0 0 0;font-size:13px;line-height:1.7;word-break:break-all;color:#334155;">
                        <a href="${safeInviteUrl}" style="color:#0f766e;text-decoration:none;">${safeInviteUrl}</a>
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 16px 0 16px;text-align:center;font-family:Arial,sans-serif;color:#64748b;">
              <p style="margin:0;font-size:12px;line-height:1.7;">
                This secure invitation was sent for <strong>${safeInviteHostname}</strong>. If you were not expecting this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </div>
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
