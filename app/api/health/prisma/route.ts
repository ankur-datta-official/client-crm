import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "prisma",
    });
  } catch (error) {
    console.error("Prisma health check failed:", error);

    return NextResponse.json(
      {
        ok: false,
        service: "prisma",
        error: "Database connection failed.",
      },
      { status: 500 },
    );
  }
}
