"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, hasPermission, requireOrganization } from "@/lib/auth/session";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getAllPlans } from "./subscription-queries";

async function insertActivityLog(action: string, entityId: string, metadata: Record<string, unknown>) {
  const organization = await requireOrganization();
  const user = await getCurrentUser();

  await prisma.$executeRaw`
    insert into public.activity_logs (
      organization_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values (
      ${organization.id}::uuid,
      ${user?.id ?? null}::uuid,
      ${action},
      'organization_subscription',
      ${entityId}::uuid,
      ${JSON.stringify(metadata)}::jsonb
    )
  `;
}

export async function switchSubscriptionPlan(planId: string) {
  const allowed = await hasPermission("subscription.manage");
  if (!allowed) {
    throw new Error("You do not have permission to change the subscription plan.");
  }

  const organization = await requireOrganization();
  const plans = await getAllPlans();
  const selectedPlan = plans.find((plan) => plan.id === planId);

  if (!selectedPlan) {
    throw new Error("Selected plan was not found.");
  }

  const subscription = await prisma.organizationSubscription.findUnique({
    where: {
      organization_id: organization.id,
    },
    select: {
      id: true,
      plan_id: true,
    },
  });

  if (!subscription) {
    throw new Error("Subscription record was not found.");
  }

  if (subscription.plan_id === planId) {
    return { success: true };
  }

  try {
    await prisma.organizationSubscription.update({
      where: {
        id: subscription.id,
        organization_id: organization.id,
      },
      data: {
        plan_id: planId,
        status: "active",
        current_period_starts_at: new Date(),
      },
    });
  } catch (error) {
    logServerError("subscription.switch", error, { organizationId: organization.id, planId });
    throw new Error(getSafeErrorMessage(error, "Unable to change the subscription plan right now."));
  }

  await insertActivityLog("subscription.plan_changed", subscription.id, {
    plan_id: planId,
    plan_name: selectedPlan.name,
    plan_slug: selectedPlan.slug,
  });

  revalidatePath("/subscription");
  revalidatePath("/dashboard");
  return { success: true };
}
