import { NextResponse } from "next/server";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getCurrentUserDashboardData();
  return NextResponse.json(dashboard);
}
