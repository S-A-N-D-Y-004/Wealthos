import { NextResponse, type NextRequest } from "next/server";
import {
  evaluateAndPersistAlerts,
  getNotificationAggregation,
  markAlertsRead,
  markAlertsUnread,
  zeroNotificationAggregation,
  type AlertEnginePrismaClient
} from "@/lib/alerts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(zeroNotificationAggregation());
  }

  const aggregation = await getNotificationAggregation({
    userId: session.user.id,
    client: prisma as unknown as AlertEnginePrismaClient
  });

  return NextResponse.json(aggregation);
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await evaluateAndPersistAlerts({
    userId: session.user.id,
    client: prisma as unknown as AlertEnginePrismaClient
  });
  const aggregation = await getNotificationAggregation({
    userId: session.user.id,
    client: prisma as unknown as AlertEnginePrismaClient
  });

  return NextResponse.json({
    evaluatedAt: result.evaluatedAt,
    generatedCount: result.generated.length,
    persistedCount: result.persistedCount,
    aggregation
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : undefined;
  const alertIds = Array.isArray(body.alertIds)
    ? body.alertIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    : undefined;

  if (action === "mark-read") {
    const result = await markAlertsRead({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient,
      alertIds
    });

    return NextResponse.json({
      updated: result.count
    });
  }

  if (action === "mark-unread") {
    const result = await markAlertsUnread({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient,
      alertIds
    });

    return NextResponse.json({
      updated: result.count
    });
  }

  return NextResponse.json({ error: "Unsupported notification action." }, { status: 400 });
}
