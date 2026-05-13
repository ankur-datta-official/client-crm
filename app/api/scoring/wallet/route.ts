import { NextResponse } from "next/server";
import { requireApiAccess } from "@/lib/api/route-auth";
import { logServerError } from "@/lib/errors";
import { getCurrentUserWalletSummary } from "@/lib/scoring/queries";

export async function GET() {
  try {
    const access = await requireApiAccess({ requireOrganization: true });
    if (!access.ok) {
      return access.response;
    }

    const summary = await getCurrentUserWalletSummary();
    return NextResponse.json(summary);
  } catch (error) {
    logServerError("api.scoring.wallet", error);
    return NextResponse.json({ error: "Unable to load wallet summary right now." }, { status: 500 });
  }
}
