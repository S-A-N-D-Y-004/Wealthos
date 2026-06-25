import { z } from "zod";
import { apiServerError, apiSuccess, apiUnauthorized, apiValidationError } from "@/lib/api/responses";
import { readJsonBody, validateJson } from "@/lib/api/request";
import {
  evaluateAndPersistAlerts,
  getNotificationAggregation,
  markAlertsRead,
  markAlertsUnread,
  type AlertEnginePrismaClient
} from "@/lib/alerts";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const notificationPatchRequestSchema = z.object({
  action: z.enum(["mark-read", "mark-unread"]),
  alertIds: z.array(z.string().min(1)).max(100).optional()
}).strict();

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const aggregation = await getNotificationAggregation({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient
    });

    return apiSuccess(aggregation);
  } catch {
    return apiServerError();
  }
}

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const result = await evaluateAndPersistAlerts({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient
    });
    const aggregation = await getNotificationAggregation({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient
    });

    return apiSuccess({
      evaluatedAt: result.evaluatedAt,
      generatedCount: result.generated.length,
      persistedCount: result.persistedCount,
      aggregation
    });
  } catch {
    return apiServerError();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const body = await readJsonBody(request);

    if (!body.ok) {
      return apiValidationError(body.message, body.details);
    }

    const parsed = validateJson(
      notificationPatchRequestSchema,
      body.data,
      "Notification update request failed validation."
    );

    if (!parsed.ok) {
      return apiValidationError(parsed.message, parsed.details);
    }

    if (parsed.data.action === "mark-read") {
      const result = await markAlertsRead({
        userId: session.user.id,
        client: prisma as unknown as AlertEnginePrismaClient,
        alertIds: parsed.data.alertIds
      });

      return apiSuccess({
        updated: result.count
      });
    }

    const result = await markAlertsUnread({
      userId: session.user.id,
      client: prisma as unknown as AlertEnginePrismaClient,
      alertIds: parsed.data.alertIds
    });

    return apiSuccess({
      updated: result.count
    });
  } catch {
    return apiServerError();
  }
}
