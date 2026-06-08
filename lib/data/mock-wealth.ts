import { calculateNetWorth, buildNetWorthTrend } from "@/lib/domain/calculations/net-worth";
import { summarizeGoals } from "@/lib/domain/calculations/goals";
import { projectRetirement } from "@/lib/domain/calculations/retirement";
import { calculateWealthScore } from "@/lib/domain/calculations/wealth-score";
import type { ActivityItem, AlertItem, GoalInput, HoldingInput, InsightItem, LiabilityInput } from "@/lib/domain/models";

const INR = "INR";

export const holdings: HoldingInput[] = [
  {
    id: "h-zerodha-niftybees",
    accountName: "Zerodha Kite",
    source: "Zerodha Kite",
    assetName: "Nippon India ETF Nifty BeES",
    symbol: "NIFTYBEES",
    assetClass: "Equity",
    assetType: "ETF",
    quantity: 840,
    averageCostMinor: 18420,
    currentPriceMinor: 24780,
    costBasisMinor: 15472800,
    currentValueMinor: 20815200,
    currency: INR
  },
  {
    id: "h-paytm-stocks",
    accountName: "Paytm Money",
    source: "Paytm Money",
    assetName: "Large Cap Equity Basket",
    symbol: "LCEQ",
    assetClass: "Equity",
    assetType: "Stock",
    quantity: 1,
    averageCostMinor: 9750000,
    currentPriceMinor: 12340000,
    costBasisMinor: 9750000,
    currentValueMinor: 12340000,
    currency: INR
  },
  {
    id: "h-angel-mf",
    accountName: "Angel One",
    source: "Angel One",
    assetName: "Flexi Cap Mutual Fund",
    symbol: "FLEXI-MF",
    assetClass: "Equity",
    assetType: "Mutual Fund",
    quantity: 6200.42,
    averageCostMinor: 4120,
    currentPriceMinor: 5360,
    costBasisMinor: 25545730,
    currentValueMinor: 33234251,
    currency: INR
  },
  {
    id: "h-icici-retirement",
    accountName: "ICICI Prudential i-Invest",
    source: "ICICI Prudential",
    assetName: "Retirement Balanced Fund",
    symbol: "RET-BAL",
    assetClass: "Debt",
    assetType: "Mutual Fund",
    quantity: 4100,
    averageCostMinor: 10000,
    currentPriceMinor: 11650,
    costBasisMinor: 41000000,
    currentValueMinor: 47765000,
    currency: INR
  },
  {
    id: "h-coindcx-btc",
    accountName: "CoinDCX",
    source: "CoinDCX",
    assetName: "Bitcoin",
    symbol: "BTC",
    assetClass: "Crypto",
    assetType: "Crypto",
    quantity: 0.42,
    averageCostMinor: 367500000,
    currentPriceMinor: 512000000,
    costBasisMinor: 154350000,
    currentValueMinor: 215040000,
    currency: INR
  },
  {
    id: "h-phonepe-gold",
    accountName: "PhonePe Gold",
    source: "PhonePe",
    assetName: "Digital Gold",
    symbol: "GOLD",
    assetClass: "Gold",
    assetType: "Gold",
    quantity: 125.5,
    averageCostMinor: 575000,
    currentPriceMinor: 716000,
    costBasisMinor: 72162500,
    currentValueMinor: 89858000,
    currency: INR
  },
  {
    id: "h-cash",
    accountName: "Manual Cash Reserve",
    source: "Manual",
    assetName: "Emergency Cash",
    assetClass: "Cash",
    assetType: "Cash",
    quantity: 1,
    averageCostMinor: 87000000,
    currentPriceMinor: 87000000,
    costBasisMinor: 87000000,
    currentValueMinor: 87000000,
    currency: INR
  }
];

export const liabilities: LiabilityInput[] = [
  {
    id: "l-home-loan",
    name: "Home Loan",
    type: "Loan",
    outstandingMinor: 184000000,
    emiMinor: 12800000,
    interestRate: 0.087,
    currency: INR
  },
  {
    id: "l-card",
    name: "Credit Card Cycle",
    type: "Credit Card",
    outstandingMinor: 920000,
    currency: INR
  }
];

export const goals: GoalInput[] = [
  {
    id: "g-emergency",
    name: "Emergency Fund",
    type: "Emergency Fund",
    targetAmountMinor: 120000000,
    currentAmountMinor: 87000000,
    monthlyContributionMinor: 7000000,
    targetDate: new Date("2027-03-31T00:00:00.000Z"),
    priority: "Critical",
    currency: INR
  },
  {
    id: "g-house",
    name: "House Upgrade",
    type: "House",
    targetAmountMinor: 450000000,
    currentAmountMinor: 126000000,
    monthlyContributionMinor: 15500000,
    targetDate: new Date("2030-12-31T00:00:00.000Z"),
    priority: "High",
    currency: INR
  },
  {
    id: "g-retirement",
    name: "Retirement Corpus",
    type: "Retirement",
    targetAmountMinor: 9500000000,
    currentAmountMinor: 420000000,
    monthlyContributionMinor: 8500000,
    targetDate: new Date("2050-06-30T00:00:00.000Z"),
    priority: "Critical",
    currency: INR
  },
  {
    id: "g-vehicle",
    name: "Vehicle Replacement",
    type: "Vehicle",
    targetAmountMinor: 35000000,
    currentAmountMinor: 11000000,
    monthlyContributionMinor: 1500000,
    targetDate: new Date("2028-09-30T00:00:00.000Z"),
    priority: "Medium",
    currency: INR
  }
];

export const activities: ActivityItem[] = [
  {
    id: "a-1",
    action: "Imported",
    entity: "CoinDCX CSV",
    summary: "Validated 42 crypto transactions with 1 duplicate held for review.",
    occurredAt: new Date("2026-06-07T14:35:00.000Z")
  },
  {
    id: "a-2",
    action: "Calculated",
    entity: "Retirement Readiness",
    summary: "Readiness refreshed using 11.5% expected return and 5.8% inflation assumptions.",
    occurredAt: new Date("2026-06-07T10:20:00.000Z")
  },
  {
    id: "a-3",
    action: "Updated",
    entity: "Emergency Fund Goal",
    summary: "Monthly funding raised to ₹70,000 after salary revision.",
    occurredAt: new Date("2026-06-06T18:05:00.000Z")
  }
];

export const alerts: AlertItem[] = [
  {
    id: "alert-1",
    type: "Portfolio",
    severity: "Warning",
    title: "Crypto concentration above policy",
    message: "Crypto exposure is above the configured 20% threshold. Review allocation drift.",
    createdAt: new Date("2026-06-07T08:30:00.000Z")
  },
  {
    id: "alert-2",
    type: "Import",
    severity: "Info",
    title: "Paytm Money statement due",
    message: "No Paytm Money CSV import has been recorded for the current month.",
    createdAt: new Date("2026-06-06T08:30:00.000Z")
  }
];

export const insights: InsightItem[] = [
  {
    id: "insight-1",
    type: "Diversification",
    title: "Allocation is growth-oriented",
    body: "Equity and crypto are the largest growth drivers. Debt and cash reserves provide ballast, but crypto volatility should be monitored against written policy limits.",
    confidence: 0.86,
    createdAt: new Date("2026-06-07T15:15:00.000Z")
  },
  {
    id: "insight-2",
    type: "Goal",
    title: "Emergency fund is close to policy target",
    body: "The emergency fund is materially funded and projected to reach target before the target date if the current monthly contribution continues.",
    confidence: 0.91,
    createdAt: new Date("2026-06-07T15:15:00.000Z")
  }
];

export const netWorth = calculateNetWorth(holdings, liabilities);
export const goalSummary = summarizeGoals(goals, new Date("2026-06-08T00:00:00.000Z"));
export const retirementProjection = projectRetirement({
  currentAge: 34,
  retirementAge: 55,
  currentCorpusMinor: 420000000,
  monthlyContributionMinor: 8500000,
  monthlyExpenseMinor: 32000000,
  inflationRate: 0.058,
  expectedAnnualReturnRate: 0.115,
  safeWithdrawalRate: 0.035
});
export const wealthScore = calculateWealthScore({
  savingsRatePercent: 31,
  investmentConsistencyPercent: 84,
  diversificationPercent: 72,
  emergencyFundCoverageMonths: 4.8,
  goalProgressPercent: goalSummary.aggregateProgressPercent
});

export const netWorthTrend = buildNetWorthTrend([
  { date: "Jan", assetsMinor: 568000000, liabilitiesMinor: 201000000 },
  { date: "Feb", assetsMinor: 594000000, liabilitiesMinor: 198200000 },
  { date: "Mar", assetsMinor: 621500000, liabilitiesMinor: 195600000 },
  { date: "Apr", assetsMinor: 648800000, liabilitiesMinor: 192400000 },
  { date: "May", assetsMinor: 690200000, liabilitiesMinor: 188900000 },
  { date: "Jun", assetsMinor: netWorth.totalAssetsMinor, liabilitiesMinor: netWorth.totalLiabilitiesMinor }
]);

export const monthlyInvestmentProgress = {
  plannedMinor: 22500000,
  actualMinor: 20900000,
  progressPercent: 92.9
};

