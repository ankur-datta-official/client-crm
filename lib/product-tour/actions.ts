"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PRODUCT_TOUR_VERSION } from "@/lib/product-tour/types";

async function updateProductTourState(values: Record<string, string | null>) {
  const user = await requireAuth();
  const organization = await requireOrganization();
  await prisma.user.updateMany({
    data: {
      ...values,
      updated_at: new Date(),
    },
    where: {
      id: user.id,
      organization_id: organization.id,
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function markProductTourStarted() {
  await updateProductTourState({
    product_tour_last_started_at: new Date().toISOString(),
  });
}

export async function skipProductTour() {
  await updateProductTourState({
    product_tour_last_skipped_version: PRODUCT_TOUR_VERSION,
    product_tour_last_started_at: new Date().toISOString(),
  });
}

export async function completeProductTour() {
  await updateProductTourState({
    product_tour_last_completed_version: PRODUCT_TOUR_VERSION,
    product_tour_last_started_at: new Date().toISOString(),
  });
}
