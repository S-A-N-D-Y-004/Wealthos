import { NextResponse } from "next/server";
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
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      articles: []
    });
  }

  const articles = await getNewsForUser({
    userId: session.user.id,
    client: prisma as unknown as NewsPrismaClient
  });

  return NextResponse.json({
    articles
  });
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshNewsForUser({
    userId: session.user.id,
    client: prisma as unknown as NewsPrismaClient,
    providers: defaultNewsProviders()
  });

  return NextResponse.json(result);
}
