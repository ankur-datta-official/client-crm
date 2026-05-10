import { NextResponse } from "next/server";
import { getNotificationCenterData } from "@/lib/notifications/notifications";

export async function GET() {
  const data = await getNotificationCenterData();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
