"use server";

import { revalidatePath } from "next/cache";
import { insertAdminAuditLog } from "@/lib/admin/audit";
import { issueAccessPasskeyForSignupRequest, rejectSignupRequest } from "@/lib/auth/access-requests";
import { getCurrentUser } from "@/lib/auth/session";

export async function issueSignupAccessPasskeyAction(requestId: string) {
  const actor = await getCurrentUser();
  const result = await issueAccessPasskeyForSignupRequest(requestId);
  await insertAdminAuditLog({
    actorUserId: actor?.id ?? null,
    action: "admin.access_request.passkey_issued",
    entityType: "signup_request",
    entityId: requestId,
    metadata: {
      email: result.email,
      expiresAt: result.expiresAt,
      emailDeliveryOk: result.emailDelivery.ok,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/access-requests");
  revalidatePath("/settings/access-requests");
  return result;
}

export async function rejectSignupRequestAction(requestId: string) {
  const actor = await getCurrentUser();
  const result = await rejectSignupRequest(requestId);
  await insertAdminAuditLog({
    actorUserId: actor?.id ?? null,
    action: "admin.access_request.rejected",
    entityType: "signup_request",
    entityId: requestId,
    metadata: {},
  });
  revalidatePath("/admin");
  revalidatePath("/admin/access-requests");
  revalidatePath("/settings/access-requests");
  return result;
}
