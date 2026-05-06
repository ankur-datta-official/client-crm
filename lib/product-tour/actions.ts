"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_TOUR_VERSION } from "@/lib/product-tour/types";

async function updateProductTourState(values: Record<string, string | null>) {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .eq("organization_id", organization.id);

  if (error) {
    throw new Error(error.message);
  }

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
