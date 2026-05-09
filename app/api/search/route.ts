import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logServerError } from "@/lib/errors";
import { globalSearch } from "@/lib/search/global-search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    await requireAuth();
    const results = await globalSearch(query, 5);
    return NextResponse.json(results);
  } catch (error) {
    logServerError("api.search", error, { queryLength: query.length });
    return NextResponse.json({ error: "Unable to load search results right now." }, { status: 500 });
  }
}
