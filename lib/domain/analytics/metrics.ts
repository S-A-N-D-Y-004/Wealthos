import {
  calculateAnnualizedReturnPercent,
  calculateCagrPercent
} from "@/lib/domain/analytics/cagr";
import {
  calculateAbsoluteReturn,
  calculateAbsoluteReturnPercent
} from "@/lib/domain/analytics/returns";
import type { HoldingInput } from "@/lib/domain/models";

export type PortfolioReturnCashFlowType = "INVESTMENT" | "WITHDRAWAL";

export type PortfolioReturnCashFlow = {
  id?: string;
  type: PortfolioReturnCashFlowType;
  amountMinor: number;
  occurredAt: Date;
};

export type PortfolioReturnPosition = {
  id?: string;
  investedAmountMinor: number;
  currentValueMinor: number;
  investedAt?: Date;
};

export type PortfolioReturnSummaryInput = {
  positions?: PortfolioReturnPosition[];
  cashFlows?: PortfolioReturnCashFlow[];
  currentValueMinor?: number;
  startDate?: Date;
  endDate?: Date;
};

export type PortfolioReturnSummary = {
  investedAmountMinor: number;
  currentValueMinor: number;
  gainLossMinor: number;
  gainLossPercent: number;
  annualizedReturnPercent: number;
  cagrPercent: number;
  period: {
    startDate?: Date;
    endDate?: Date;
  };
};

export function summarizePortfolioReturns(input: PortfolioReturnSummaryInput): PortfolioReturnSummary {
  const positions = input.positions ?? [];
  const cashFlows = input.cashFlows ?? [];
  const investedAmountMinor =
    cashFlows.length > 0
      ? calculateNetInvestedAmount(cashFlows)
      : positions.reduce((sum, position) => sum + position.investedAmountMinor, 0);
  const currentValueMinor =
    input.currentValueMinor ?? positions.reduce((sum, position) => sum + position.currentValueMinor, 0);
  const startDate = input.startDate ?? earliestDate([
    ...positions.map((position) => position.investedAt),
    ...cashFlows.map((cashFlow) => cashFlow.occurredAt)
  ]);
  const endDate = input.endDate;
  const gainLossMinor = calculateAbsoluteReturn({
    investedAmountMinor,
    currentValueMinor
  });
  const gainLossPercent = calculateAbsoluteReturnPercent({
    investedAmountMinor,
    currentValueMinor
  });
  const periodInput = startDate && endDate
    ? {
        investedAmountMinor,
        currentValueMinor,
        startDate,
        endDate
      }
    : undefined;

  return {
    investedAmountMinor,
    currentValueMinor,
    gainLossMinor,
    gainLossPercent,
    annualizedReturnPercent: periodInput ? calculateAnnualizedReturnPercent(periodInput) : 0,
    cagrPercent: periodInput ? calculateCagrPercent(periodInput) : 0,
    period: {
      startDate,
      endDate
    }
  };
}

export function summarizeHoldingReturns(
  holdings: HoldingInput[],
  period: Pick<PortfolioReturnSummaryInput, "startDate" | "endDate"> = {}
) {
  return summarizePortfolioReturns({
    positions: holdings.map(holdingToReturnPosition),
    ...period
  });
}

export function holdingToReturnPosition(holding: HoldingInput): PortfolioReturnPosition {
  return {
    id: holding.id,
    investedAmountMinor: holding.costBasisMinor,
    currentValueMinor: holding.currentValueMinor
  };
}

export function calculateNetInvestedAmount(cashFlows: PortfolioReturnCashFlow[]) {
  return cashFlows.reduce((sum, cashFlow) => {
    if (cashFlow.type === "INVESTMENT") {
      return sum + cashFlow.amountMinor;
    }

    return sum - cashFlow.amountMinor;
  }, 0);
}

function earliestDate(dates: Array<Date | undefined>) {
  return dates
    .filter((date): date is Date => date instanceof Date && Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime())[0];
}
