import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { getCurrentUserWalletSummary } from "@/lib/scoring/queries";

export async function GET() {
  try {
    await requireAuth();
    const summary = await getCurrentUserWalletSummary();
    return NextResponse.json(summary);
  } catch (error) {
    logServerError("api.scoring.wallet", error);
    return NextResponse.json({ error: "Unable to load wallet summary right now." }, { status: 500 });
  }
}
