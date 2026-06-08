import { NextResponse } from "next/server";
import {
  goalSummary,
  monthlyInvestmentProgress,
  netWorth,
  netWorthTrend,
  retirementProjection,
  wealthScore
} from "@/lib/data/mock-wealth";

export async function GET() {
  return NextResponse.json({
    netWorth,
    netWorthTrend,
    goalSummary,
    retirementProjection,
    wealthScore,
    monthlyInvestmentProgress
  });
}

