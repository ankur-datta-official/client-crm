import "server-only";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { getCurrentProfile, requireAuth } from "@/lib/auth/session";
import { createGlobalNotifications } from "@/lib/notifications/notifications";
import { prisma } from "@/lib/prisma";
import { ensureRegistrationEmailAvailable } from "@/lib/auth/register";
import { sendAccessPasskeyIssuedEmail, sendSignupRequestSubmittedEmails } from "@/lib/auth/access-request-email";
import { resolveSuperAdminAccess } from "@/lib/auth/super-admin";

export type SignupRequestStatus = "pending" | "approved" | "rejected" | "completed";

export type SignupRequestRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: SignupRequestStatus;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  completed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  last_passkey_issued_at: string | null;
  latest_passkey_expires_at: string | null;
  latest_passkey_used_at: string | null;
  latest_passkey_created_at: string | null;
  latest_passkey_is_expired: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPasskey(email: string, passkey: string) {
  return createHash("sha256").update(`${normalizeEmail(email)}:${passkey.trim()}`).digest("hex");
}

function buildPlainPasskey() {
  const raw = randomBytes(9).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const token = raw.slice(0, 12).padEnd(12, "7");
  return `${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

function runDetached(label: string, task: Promise<unknown>) {
  void task.catch((error) => {
    console.error(`${label}:`, error);
  });
}

async function requireSuperAdmin() {
  const [user, profile] = await Promise.all([requireAuth(), getCurrentProfile()]);

  if (!profile?.is_super_admin) {
    throw new Error("Only super admins can manage account access requests.");
  }

  return { user, profile };
}

async function getActiveSuperAdminRecipients() {
  const admins = await prisma.user.findMany({
    where: {
      is_active: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      is_super_admin: true,
    },
    orderBy: [
      {
        name: "asc",
      },
      {
        email: "asc",
      },
    ],
  });

  return admins
    .filter((admin) =>
      resolveSuperAdminAccess({
        email: admin.email,
        isSuperAdmin: admin.is_super_admin,
      }),
    )
    .map((admin) => ({
      id: admin.id,
      email: admin.email,
      full_name: admin.name,
    }));
}

export async function listSignupRequestsForAdmin(): Promise<SignupRequestRow[]> {
  await requireSuperAdmin();

  const rows = await prisma.$queryRaw<SignupRequestRow[]>`
    select
      sr.id::text as id,
      sr.email,
      sr.full_name,
      sr.status,
      sr.requested_at::text as requested_at,
      sr.approved_at::text as approved_at,
      sr.rejected_at::text as rejected_at,
      sr.completed_at::text as completed_at,
      sr.reviewed_by::text as reviewed_by,
      sr.notes,
      sr.last_passkey_issued_at::text as last_passkey_issued_at,
      ap.expires_at::text as latest_passkey_expires_at,
      ap.used_at::text as latest_passkey_used_at,
      ap.created_at::text as latest_passkey_created_at,
      coalesce(ap.expires_at <= now(), false) as latest_passkey_is_expired
    from public.signup_requests sr
    left join lateral (
      select
        ak.expires_at,
        ak.used_at,
        ak.created_at
      from public.access_passkeys ak
      where ak.signup_request_id = sr.id
      order by ak.created_at desc
      limit 1
    ) ap on true
    order by
      case sr.status
        when 'pending' then 0
        when 'approved' then 1
        when 'rejected' then 2
        when 'completed' then 3
        else 4
      end,
      sr.requested_at desc
  `;

  return rows;
}

export async function getPendingSignupRequestCountForSuperAdmin() {
  const profile = await getCurrentProfile();

  if (!profile?.is_super_admin) {
    return 0;
  }

  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from public.signup_requests
    where status = 'pending'
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function createSignupRequest(input: {
  email: string;
  password: string;
  fullName?: string | null;
}) {
  const availability = await ensureRegistrationEmailAvailable(input.email);

  if (!availability.ok) {
    throw new Error(availability.error);
  }

  const email = availability.email;
  const fullName = input.fullName?.trim() || null;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = new Date();

  const existingRows = await prisma.$queryRaw<Array<{ id: string; status: string }>>`
    select id::text as id, status
    from public.signup_requests
    where email = ${email}
    limit 1
  `;

  const existing = existingRows[0] ?? null;

  if (existing) {
    await prisma.$executeRaw`
      update public.signup_requests
      set
        full_name = ${fullName},
        password_hash = ${passwordHash},
        status = 'pending',
        requested_at = now(),
        approved_at = null,
        rejected_at = null,
        completed_at = null,
        reviewed_by = null,
        notes = null,
        updated_at = now()
      where id = ${existing.id}::uuid
    `;

    await prisma.$executeRaw`
      delete from public.access_passkeys
      where signup_request_id = ${existing.id}::uuid
        and used_at is null
    `;
  } else {
    await prisma.$executeRaw`
      insert into public.signup_requests (
        email,
        full_name,
        password_hash,
        status,
        requested_at,
        created_at,
        updated_at
      )
      values (
        ${email},
        ${fullName},
        ${passwordHash},
        'pending',
        now(),
        now(),
        now()
      )
    `;
  }

  const recipients = await getActiveSuperAdminRecipients();

  await createGlobalNotifications({
    userIds: recipients.map((recipient) => recipient.id),
    type: "admin.access_request.submitted",
    title: "New access request submitted",
    message: fullName
      ? `${fullName} requested admin approval for ${email}.`
      : `${email} requested admin approval for a new account.`,
    link: "/admin/access-requests",
    payload: {
      email,
      fullName,
      requestedAt: now.toISOString(),
    },
  });

  runDetached(
    "Failed to send signup request notification emails",
    sendSignupRequestSubmittedEmails({
      recipients: recipients.map((recipient) => ({
        email: recipient.email,
        fullName: recipient.full_name,
      })),
      requesterEmail: email,
      requesterName: fullName,
      requestedAt: now,
    }),
  );

  return {
    ok: true as const,
    email,
    message: "Your access request has been submitted. An administrator will review it soon.",
  };
}

export async function issueAccessPasskeyForSignupRequest(requestId: string) {
  const { user } = await requireSuperAdmin();

  const requestRows = await prisma.$queryRaw<Array<{
    id: string;
    email: string;
    full_name: string | null;
    status: string;
  }>>`
    select id::text as id, email, full_name, status
    from public.signup_requests
    where id = ${requestId}::uuid
    limit 1
  `;

  const request = requestRows[0] ?? null;

  if (!request) {
    throw new Error("Signup request not found.");
  }

  if (request.status === "completed") {
    throw new Error("This signup request has already been completed.");
  }

  const plainPasskey = buildPlainPasskey();
  const tokenHash = hashPasskey(request.email, plainPasskey);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.$executeRaw`
      delete from public.access_passkeys
      where signup_request_id = ${request.id}::uuid
        and used_at is null
    `,
    prisma.$executeRaw`
      insert into public.access_passkeys (
        signup_request_id,
        email,
        token_hash,
        expires_at,
        issued_by,
        created_at
      )
      values (
        ${request.id}::uuid,
        ${request.email},
        ${tokenHash},
        now() + interval '24 hours',
        ${user.id}::uuid,
        now()
      )
    `,
    prisma.$executeRaw`
      update public.signup_requests
      set
        status = 'approved',
        approved_at = now(),
        rejected_at = null,
        reviewed_by = ${user.id}::uuid,
        last_passkey_issued_at = now(),
        updated_at = now()
      where id = ${request.id}::uuid
    `,
  ]);

  const adminRecipients = await getActiveSuperAdminRecipients();
  await createGlobalNotifications({
    userIds: adminRecipients.map((recipient) => recipient.id),
    type: "admin.access_request.passkey_issued",
    title: "Access passkey issued",
    message: `A one-time access passkey was issued for ${request.email}.`,
    link: "/admin/access-requests",
    payload: {
      email: request.email,
      requestId: request.id,
      issuedBy: user.id,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  });

  const emailDelivery = await sendAccessPasskeyIssuedEmail({
    email: request.email,
    fullName: request.full_name,
    passkey: plainPasskey,
    expiresAt,
  }).catch((error) => ({
    ok: false as const,
    reason: error instanceof Error ? error.message : "Unable to send passkey email.",
  }));

  return {
    requestId: request.id,
    email: request.email,
    passkey: plainPasskey,
    expiresAt: expiresAt.toISOString(),
    emailDelivery,
  };
}

export async function rejectSignupRequest(requestId: string) {
  const { user } = await requireSuperAdmin();
  const now = new Date();

  const requestRows = await prisma.$queryRaw<Array<{
    id: string;
    email: string;
    full_name: string | null;
  }>>`
    select id::text as id, email, full_name
    from public.signup_requests
    where id = ${requestId}::uuid
    limit 1
  `;

  const request = requestRows[0] ?? null;

  if (!request) {
    throw new Error("Signup request not found.");
  }

  await prisma.$transaction([
    prisma.$executeRaw`
      update public.signup_requests
      set
        status = 'rejected',
        rejected_at = now(),
        reviewed_by = ${user.id}::uuid,
        updated_at = now()
      where id = ${requestId}::uuid
    `,
    prisma.$executeRaw`
      delete from public.access_passkeys
      where signup_request_id = ${requestId}::uuid
        and used_at is null
    `,
  ]);

  const adminRecipients = await getActiveSuperAdminRecipients();
  await createGlobalNotifications({
    userIds: adminRecipients.map((recipient) => recipient.id),
    type: "admin.access_request.rejected",
    title: "Access request rejected",
    message: `The access request for ${request.email} was rejected.`,
    link: "/admin/access-requests",
    payload: {
      email: request.email,
      requestId: request.id,
      rejectedBy: user.id,
      rejectedAt: now.toISOString(),
    },
  });

  return { ok: true as const };
}

export async function validateSignupPasskey(input: { email: string; passkey: string }) {
  const email = normalizeEmail(input.email);
  const availability = await ensureRegistrationEmailAvailable(email);

  if (!availability.ok) {
    throw new Error(availability.error);
  }

  const tokenHash = hashPasskey(email, input.passkey);
  const rows = await prisma.$queryRaw<Array<{
    passkey_id: string;
    request_id: string;
    expires_at: Date;
    used_at: Date | null;
    full_name: string | null;
    password_hash: string;
    status: string;
  }>>`
    select
      ap.id::text as passkey_id,
      sr.id::text as request_id,
      ap.expires_at,
      ap.used_at,
      sr.full_name,
      sr.password_hash,
      sr.status
    from public.access_passkeys ap
    inner join public.signup_requests sr on sr.id = ap.signup_request_id
    where ap.email = ${email}
      and ap.token_hash = ${tokenHash}
    order by ap.created_at desc
    limit 1
  `;

  const record = rows[0] ?? null;

  if (!record) {
    throw new Error("The access passkey is invalid. Check it and try again.");
  }

  if (record.status === "rejected") {
    throw new Error("This signup request has been rejected. Submit a new request to continue.");
  }

  if (record.used_at) {
    throw new Error("This access passkey has already been used.");
  }

  if (record.expires_at.getTime() <= Date.now()) {
    throw new Error("This access passkey has expired. Request a new one from the administrator.");
  }

  return record;
}

export async function markSignupRequestCompleted(input: { requestId: string; passkeyId: string }) {
  await prisma.$transaction([
    prisma.$executeRaw`
      update public.access_passkeys
      set used_at = now()
      where id = ${input.passkeyId}::uuid
        and used_at is null
    `,
    prisma.$executeRaw`
      update public.signup_requests
      set
        status = 'completed',
        completed_at = now(),
        updated_at = now()
      where id = ${input.requestId}::uuid
    `,
  ]);
}
