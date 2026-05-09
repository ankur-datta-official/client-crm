import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { getActiveRewards, getRewardRedemptionHistory } from "@/lib/scoring/queries";

export async function GET() {
  try {
    await requireAuth();
    const [rewards, redemptions] = await Promise.all([
      getActiveRewards(),
      getRewardRedemptionHistory(20),
    ]);
    return NextResponse.json({ rewards, redemptions });
  } catch (error) {
    logServerError("api.scoring.rewards", error);
    return NextResponse.json({ error: "Unable to load rewards right now." }, { status: 500 });
  }
}
