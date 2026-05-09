import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { redeemRewardAction } from "@/lib/scoring/actions";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const rewardId = typeof body?.rewardId === "string" ? body.rewardId : "";

    if (!rewardId) {
      return NextResponse.json({ error: "rewardId is required." }, { status: 400 });
    }

    const result = await redeemRewardAction(rewardId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Unable to redeem reward." }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    logServerError("api.scoring.redeem", error);
    return NextResponse.json({ error: "Unable to redeem reward right now." }, { status: 500 });
  }
}
