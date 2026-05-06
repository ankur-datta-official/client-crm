import { requireAuth, requireOrganization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_TOUR_VERSION, type ProductTourState } from "@/lib/product-tour/types";

type ProductTourProfileRow = {
  product_tour_last_completed_version: string | null;
  product_tour_last_skipped_version: string | null;
  product_tour_last_started_at: string | null;
};

export async function getCurrentProductTourState(): Promise<ProductTourState> {
  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("product_tour_last_completed_version, product_tour_last_skipped_version, product_tour_last_started_at")
    .eq("id", user.id)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = (data ?? {
    product_tour_last_completed_version: null,
    product_tour_last_skipped_version: null,
    product_tour_last_started_at: null,
  }) as ProductTourProfileRow;

  return {
    version: PRODUCT_TOUR_VERSION,
    lastCompletedVersion: row.product_tour_last_completed_version,
    lastSkippedVersion: row.product_tour_last_skipped_version,
    lastStartedAt: row.product_tour_last_started_at,
    shouldAutoStart:
      row.product_tour_last_completed_version !== PRODUCT_TOUR_VERSION
      && row.product_tour_last_skipped_version !== PRODUCT_TOUR_VERSION,
  };
}
