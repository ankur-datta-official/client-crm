import "server-only";

import { prisma } from "@/lib/prisma";

export async function insertAdminAuditLog(input: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.$executeRaw`
    insert into public.admin_audit_logs (
      actor_user_id,
      target_user_id,
      organization_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      ${input.actorUserId ?? null}::uuid,
      ${input.targetUserId ?? null}::uuid,
      ${input.organizationId ?? null}::uuid,
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
  `;
}
