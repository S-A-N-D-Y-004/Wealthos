import type { Money } from "@/lib/domain/money";

export type AssetClass =
  | "Equity"
  | "Debt"
  | "Cash"
  | "Gold"
  | "Crypto"
  | "Real Estate"
  | "Alternative";

export type AssetType =
  | "Stock"
  | "ETF"
  | "Mutual Fund"
  | "Crypto"
  | "Gold"
  | "Cash"
  | "Fixed Deposit";

export type BrokerSource =
  | "Angel One"
  | "CoinDCX"
  | "Zerodha Kite"
  | "Paytm Money"
  | "PhonePe"
  | "ICICI Prudential"
  | "Manual";

export type HoldingInput = {
  id: string;
  accountName: string;
  source: BrokerSource;
  assetName: string;
  symbol?: string;
  assetClass: AssetClass;
  assetType: AssetType;
  quantity: number;
  averageCostMinor: number;
  currentPriceMinor: number;
  costBasisMinor: number;
  currentValueMinor: number;
  currency: string;
};

export type LiabilityInput = {
  id: string;
  name: string;
  type: "Loan" | "Credit Card" | "EMI";
  outstandingMinor: number;
  emiMinor?: number;
  interestRate?: number;
  currency: string;
};

export type GoalInput = {
  id: string;
  name: string;
  type: "Emergency Fund" | "House" | "Vehicle" | "Retirement" | "Custom";
  targetAmountMinor: number;
  currentAmountMinor: number;
  monthlyContributionMinor: number;
  targetDate: Date;
  priority: "Low" | "Medium" | "High" | "Critical";
  currency: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  summary: string;
  occurredAt: Date;
};

export type AlertItem = {
  id: string;
  type: "Goal" | "Retirement" | "Portfolio" | "Import" | "System";
  severity: "Info" | "Warning" | "Critical";
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  metadata?: unknown;
};

export type InsightItem = {
  id: string;
  type: "Net Worth" | "Goal" | "Retirement" | "Diversification" | "Risk";
  title: string;
  body: string;
  confidence: number;
  createdAt: Date;
};

export type NewsSentiment = "Positive" | "Neutral" | "Negative";

export type NewsItem = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  sourceName?: string;
  publishedAt: Date;
  sentiment: NewsSentiment;
  sentimentScore: number;
  symbols: string[];
  assetNames: string[];
};

export type HoldingView = HoldingInput & {
  gainLossMinor: number;
  gainLossPercent: number;
  allocationPercent: number;
};

export type Metric = {
  label: string;
  value: Money | number | string;
  trend?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
};
