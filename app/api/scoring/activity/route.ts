import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { getCompanyScoringHistory, getUserWalletTransactions } from "@/lib/scoring/queries";

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  const userId = request.nextUrl.searchParams.get("userId") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

  try {
    await requireAuth();
    if (companyId) {
      const activity = await getCompanyScoringHistory(companyId, limit);
      return NextResponse.json(activity);
    }

    const transactions = await getUserWalletTransactions(userId, limit);
    return NextResponse.json(transactions);
  } catch (error) {
    logServerError("api.scoring.activity", error, { companyId, userId, limit });
    return NextResponse.json({ error: "Unable to load scoring activity right now." }, { status: 500 });
  }
}
