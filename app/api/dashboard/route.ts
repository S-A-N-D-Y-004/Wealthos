import { apiServerError, apiSuccess, apiUnauthorized } from "@/lib/api/responses";
import { auth } from "@/lib/auth";
import {
  buildLedgerDashboardData,
  type DashboardPrismaClient
} from "@/lib/dashboard/ledger-dashboard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const dashboard = await buildLedgerDashboardData({
      userId: session.user.id,
      client: prisma as unknown as DashboardPrismaClient
    });

    return apiSuccess(dashboard);
  } catch {
    return apiServerError();
  }
}
