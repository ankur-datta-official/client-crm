import { NextResponse } from "next/server";
import { buildTeamDashboardExport } from "@/lib/dashboard/team-dashboard-export";
import { getSafeErrorMessage, logServerError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      from?: string | null;
      to?: string | null;
      managerId?: string | null;
      teamId?: string | null;
      memberId?: string | null;
    };

    const result = await buildTeamDashboardExport(payload);

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logServerError("api.export.team-dashboard", error);
    const message = getSafeErrorMessage(error, "Unable to export the team dashboard right now.");
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
