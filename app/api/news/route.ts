import { apiServerError, apiSuccess, apiUnauthorized } from "@/lib/api/responses";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  defaultNewsProviders,
  getNewsForUser,
  refreshNewsForUser,
  type NewsPrismaClient
} from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiUnauthorized();
    }

    const articles = await getNewsForUser({
      userId: session.user.id,
      client: prisma as unknown as NewsPrismaClient
    });

    return apiSuccess({
      articles
    });
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

    const result = await refreshNewsForUser({
      userId: session.user.id,
      client: prisma as unknown as NewsPrismaClient,
      providers: defaultNewsProviders()
    });

    return apiSuccess(result);
  } catch {
    return apiServerError();
  }
}
