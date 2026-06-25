import { apiServerError, apiSuccess, apiUnauthorized } from "@/lib/api/responses";
import { auth } from "@/lib/auth";
import type { DashboardPrismaClient } from "@/lib/dashboard/ledger-dashboard";
import { getDashboardProjection } from "@/lib/dashboard/projections";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const dashboard = await getDashboardProjection({
      userId: session.user.id,
      client: prisma as unknown as DashboardPrismaClient
    });

    return apiSuccess(dashboard);
  } catch {
    return apiServerError();
  }
}
