import { getCurrentAppContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PRODUCT_TOUR_VERSION, type ProductTourState } from "@/lib/product-tour/types";

type ProductTourProfileRow = {
  product_tour_last_completed_version: string | null;
  product_tour_last_skipped_version: string | null;
  product_tour_last_started_at: Date | null;
};

function getDefaultProductTourState(): ProductTourState {
  return {
    version: PRODUCT_TOUR_VERSION,
    lastCompletedVersion: null,
    lastSkippedVersion: null,
    lastStartedAt: null,
    shouldAutoStart: false,
  };
}

export async function getCurrentProductTourState(): Promise<ProductTourState> {
  const { user, organization } = await getCurrentAppContext();

  if (!organization) {
    return getDefaultProductTourState();
  }

  const data = await prisma.user.findFirst({
    where: {
      id: user.id,
      organization_id: organization.id,
    },
    select: {
      product_tour_last_completed_version: true,
      product_tour_last_skipped_version: true,
      product_tour_last_started_at: true,
    },
  });

  const row = (data ?? {
    product_tour_last_completed_version: null,
    product_tour_last_skipped_version: null,
    product_tour_last_started_at: null as Date | null,
  }) as ProductTourProfileRow;

  return {
    ...getDefaultProductTourState(),
    lastCompletedVersion: row.product_tour_last_completed_version,
    lastSkippedVersion: row.product_tour_last_skipped_version,
    lastStartedAt: row.product_tour_last_started_at?.toISOString() ?? null,
    shouldAutoStart:
      row.product_tour_last_started_at == null
      && row.product_tour_last_completed_version !== PRODUCT_TOUR_VERSION
      && row.product_tour_last_skipped_version !== PRODUCT_TOUR_VERSION,
  };
}
