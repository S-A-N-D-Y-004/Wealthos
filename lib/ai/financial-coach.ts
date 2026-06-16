import { createHash } from "node:crypto";
import {
  buildLedgerDashboardData,
  createZeroDashboardData,
  type DashboardPrismaClient,
  type LedgerDashboardData
} from "@/lib/dashboard/ledger-dashboard";
import { assertInsightSafety } from "@/lib/ai/insight-policy";
import type { AIProvider, InsightPrompt } from "@/lib/ai/providers";
import type { AlertItem, AssetClass, HoldingView, InsightItem } from "@/lib/domain/models";

export const AI_COACH_PROMPT_VERSION = "financial-coach-v1";

export type FinancialCoachCapability =
  | "wealth-score"
  | "goal-progress"
  | "retirement-readiness"
  | "alerts"
  | "allocation-risk"
  | "diversification-analysis"
  | "concentration-analysis"
  | "savings-analysis"
  | "goal-tracking"
  | "contextual-answer";

export type FinancialCoachContext = {
  asOf: string;
  portfolioState: "empty" | "active";
  currency: string;
  netWorth: {
    totalAssetsMinor: number;
    totalLiabilitiesMinor: number;
    netWorthMinor: number;
  };
  wealthScore: {
    score: number;
    grade: string;
    weakestComponents: Array<{
      name: string;
      score: number;
      recommendation: string;
    }>;
  };
  allocation: Array<{
    assetClass: string;
    valueMinor: number;
    allocationPercent: number;
  }>;
  holdings: Array<{
    assetName: string;
    symbol?: string;
    assetClass: AssetClass;
    assetType: string;
    accountName: string;
    valueMinor: number;
    costBasisMinor: number;
    gainLossMinor: number;
    gainLossPercent: number;
    allocationPercent: number;
  }>;
  goals: {
    aggregateProgressPercent: number;
    totalTargetMinor: number;
    totalCurrentMinor: number;
    offTrack: Array<{
      id: string;
      name: string;
      priority: string;
      progressPercent: number;
      fundingGapMinor: number;
      monthlyRequiredMinor: number;
      monthlyContributionMinor: number;
      targetDate: string;
    }>;
  };
  savings: {
    plannedMonthlyMinor: number;
    actualMonthlyMinor: number;
    progressPercent: number;
  };
  retirement: {
    yearsToRetirement: number;
    futureCorpusMinor: number;
    requiredCorpusMinor: number;
    readinessPercent: number;
    fundingGapMinor: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
  }>;
  priceMovements: Array<{
    assetId?: string;
    symbol?: string;
    changePercent?: number;
    latestPriceMinor?: number;
    previousPriceMinor?: number;
    asOf?: string;
    summary: string;
  }>;
  guardrails: string[];
};

export type GeneratedFinancialInsight = {
  id: string;
  type: AIInsightType;
  provider: string;
  model?: string;
  promptVersion: string;
  inputDigest: string;
  title: string;
  body: string;
  confidence: number;
  metadata: {
    capability: FinancialCoachCapability;
    contextDigest: string;
    userQuestion?: string;
    generatedAt: string;
  };
};

export type AIInsightType =
  | "NET_WORTH"
  | "GOAL"
  | "RETIREMENT"
  | "DIVERSIFICATION"
  | "RISK_CONCENTRATION"
  | "INVESTMENT_DISCIPLINE";

export type AIInsightPrismaClient = DashboardPrismaClient & {
  aiInsight: DashboardPrismaClient["aiInsight"] & {
    createMany(args: unknown): Promise<{ count: number }>;
  };
};

export type FinancialCoachGenerationResult = {
  generatedAt: Date;
  provider: string;
  insights: GeneratedFinancialInsight[];
  persistedCount: number;
};

const PERIODIC_CAPABILITIES: FinancialCoachCapability[] = [
  "diversification-analysis",
  "concentration-analysis",
  "savings-analysis",
  "goal-tracking"
];

const GUARDRAILS = [
  "Advisory only: explain, analyze, educate, and summarize.",
  "No buy, sell, hold, timing, target price, or market direction recommendations.",
  "No trade execution or order-placement language.",
  "Use supplied WealthOS facts only and state uncertainty plainly."
];

export function buildFinancialCoachContext(
  dashboard: LedgerDashboardData,
  {
    asOf = new Date(),
    maxHoldings = 8,
    maxAlerts = 8
  }: {
    asOf?: Date;
    maxHoldings?: number;
    maxAlerts?: number;
  } = {}
): FinancialCoachContext {
  const weakestComponents = [...dashboard.wealthScore.components]
    .sort((left, right) => left.score - right.score || left.name.localeCompare(right.name))
    .slice(0, 3)
    .map((component) => ({
      name: component.name,
      score: component.score,
      recommendation: component.recommendation
    }));
  const holdings = aggregateHoldings(dashboard.netWorth.holdings)
    .slice(0, maxHoldings)
    .map((holding) => ({
      assetName: holding.assetName,
      symbol: holding.symbol,
      assetClass: holding.assetClass,
      assetType: holding.assetType,
      accountName: holding.accountName,
      valueMinor: holding.currentValueMinor,
      costBasisMinor: holding.costBasisMinor,
      gainLossMinor: holding.gainLossMinor,
      gainLossPercent: holding.gainLossPercent,
      allocationPercent: holding.allocationPercent
    }));
  const alerts = [...dashboard.alerts]
    .sort(compareAlerts)
    .slice(0, maxAlerts)
    .map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      createdAt: alert.createdAt.toISOString()
    }));
  const priceMovements = extractPriceMovements(dashboard.alerts);

  return {
    asOf: asOf.toISOString(),
    portfolioState: dashboard.netWorth.totalAssetsMinor === 0 && dashboard.transactions.length === 0 ? "empty" : "active",
    currency: dashboard.holdings[0]?.currency ?? dashboard.liabilities[0]?.currency ?? dashboard.goals[0]?.currency ?? "INR",
    netWorth: {
      totalAssetsMinor: dashboard.netWorth.totalAssetsMinor,
      totalLiabilitiesMinor: dashboard.netWorth.totalLiabilitiesMinor,
      netWorthMinor: dashboard.netWorth.netWorthMinor
    },
    wealthScore: {
      score: dashboard.wealthScore.score,
      grade: dashboard.wealthScore.grade,
      weakestComponents
    },
    allocation: [...dashboard.netWorth.assetAllocation].sort(
      (left, right) => right.allocationPercent - left.allocationPercent || left.assetClass.localeCompare(right.assetClass)
    ),
    holdings,
    goals: {
      aggregateProgressPercent: dashboard.goalSummary.aggregateProgressPercent,
      totalTargetMinor: dashboard.goalSummary.totalTargetMinor,
      totalCurrentMinor: dashboard.goalSummary.totalCurrentMinor,
      offTrack: dashboard.goalSummary.criticalOffTrack
        .map((goal) => ({
          id: goal.id,
          name: goal.name,
          priority: goal.priority,
          progressPercent: goal.progressPercent,
          fundingGapMinor: goal.fundingGapMinor,
          monthlyRequiredMinor: goal.monthlyRequiredMinor,
          monthlyContributionMinor: goal.monthlyContributionMinor,
          targetDate: goal.targetDate.toISOString()
        }))
        .sort((left, right) => right.fundingGapMinor - left.fundingGapMinor || left.name.localeCompare(right.name))
    },
    savings: {
      plannedMonthlyMinor: dashboard.monthlyInvestmentProgress.plannedMinor,
      actualMonthlyMinor: dashboard.monthlyInvestmentProgress.actualMinor,
      progressPercent: dashboard.monthlyInvestmentProgress.progressPercent
    },
    retirement: {
      yearsToRetirement: dashboard.retirementProjection.yearsToRetirement,
      futureCorpusMinor: dashboard.retirementProjection.futureCorpusMinor,
      requiredCorpusMinor: dashboard.retirementProjection.requiredCorpusMinor,
      readinessPercent: dashboard.retirementProjection.readinessPercent,
      fundingGapMinor: Math.max(
        dashboard.retirementProjection.requiredCorpusMinor - dashboard.retirementProjection.futureCorpusMinor,
        0
      )
    },
    alerts,
    priceMovements,
    guardrails: GUARDRAILS
  };
}

export function buildFinancialCoachPrompt({
  dashboard,
  capability,
  userQuestion,
  asOf = new Date()
}: {
  dashboard: LedgerDashboardData;
  capability: FinancialCoachCapability;
  userQuestion?: string;
  asOf?: Date;
}): InsightPrompt {
  const context = buildFinancialCoachContext(dashboard, { asOf });
  const config = capabilityConfig(capability);

  return {
    type: config.promptType,
    promptVersion: AI_COACH_PROMPT_VERSION,
    instructions: [
      config.instruction,
      "Answer from the supplied context only.",
      "Keep the response educational and analytical.",
      "Do not recommend buying, selling, holding, timing, target prices, or trade execution."
    ],
    facts: {
      capability,
      context,
      outputContract: {
        style: "concise educational analysis",
        include: config.include,
        avoid: ["buy/sell/hold instructions", "price predictions", "trade execution", "unsupported personal assumptions"]
      }
    },
    userQuestion
  };
}

export function generateFinancialCoachInsight({
  dashboard,
  capability,
  provider = createDeterministicFinancialCoachProvider(),
  userQuestion,
  asOf = new Date(),
  model
}: {
  dashboard: LedgerDashboardData;
  capability: FinancialCoachCapability;
  provider?: AIProvider;
  userQuestion?: string;
  asOf?: Date;
  model?: string;
}): Promise<GeneratedFinancialInsight> {
  const prompt = buildFinancialCoachPrompt({
    dashboard,
    capability,
    userQuestion,
    asOf
  });

  return generateFromPrompt({
    prompt,
    provider,
    capability,
    userQuestion,
    asOf,
    model,
    dashboard
  });
}

export async function generatePeriodicFinancialInsights({
  dashboard,
  provider = createDeterministicFinancialCoachProvider(),
  asOf = new Date(),
  capabilities = PERIODIC_CAPABILITIES,
  model
}: {
  dashboard: LedgerDashboardData;
  provider?: AIProvider;
  asOf?: Date;
  capabilities?: FinancialCoachCapability[];
  model?: string;
}) {
  const insights: GeneratedFinancialInsight[] = [];

  for (const capability of capabilities) {
    insights.push(
      await generateFinancialCoachInsight({
        dashboard,
        provider,
        capability,
        asOf,
        model
      })
    );
  }

  return insights;
}

export async function generateAndPersistPeriodicInsights({
  userId,
  client,
  provider = createDeterministicFinancialCoachProvider(),
  asOf = new Date(),
  capabilities = PERIODIC_CAPABILITIES,
  model
}: {
  userId: string;
  client: AIInsightPrismaClient;
  provider?: AIProvider;
  asOf?: Date;
  capabilities?: FinancialCoachCapability[];
  model?: string;
}): Promise<FinancialCoachGenerationResult> {
  const dashboard = await buildLedgerDashboardData({
    userId,
    client,
    asOf
  });
  const insights = await generatePeriodicFinancialInsights({
    dashboard,
    provider,
    asOf,
    capabilities,
    model
  });
  const persistedCount = await persistGeneratedInsights({
    userId,
    client,
    insights
  });

  return {
    generatedAt: asOf,
    provider: provider.name,
    insights,
    persistedCount
  };
}

export async function generateAndPersistCoachResponse({
  userId,
  client,
  capability = "contextual-answer",
  userQuestion,
  provider = createDeterministicFinancialCoachProvider(),
  asOf = new Date(),
  model
}: {
  userId: string;
  client: AIInsightPrismaClient;
  capability?: FinancialCoachCapability;
  userQuestion?: string;
  provider?: AIProvider;
  asOf?: Date;
  model?: string;
}) {
  const dashboard = await buildLedgerDashboardData({
    userId,
    client,
    asOf
  });
  const insight = await generateFinancialCoachInsight({
    dashboard,
    capability,
    userQuestion,
    provider,
    asOf,
    model
  });
  const persistedCount = await persistGeneratedInsights({
    userId,
    client,
    insights: [insight]
  });

  return {
    generatedAt: asOf,
    provider: provider.name,
    insight,
    persistedCount
  };
}

export async function getCurrentUserFinancialCoachZeroState() {
  return generatePeriodicFinancialInsights({
    dashboard: createZeroDashboardData()
  });
}

export function createDeterministicFinancialCoachProvider(): AIProvider {
  return {
    name: "deterministic",
    async generateInsight(prompt) {
      const facts = prompt.facts as { capability?: FinancialCoachCapability; context?: FinancialCoachContext };
      const capability = facts.capability ?? "contextual-answer";
      const context = facts.context ?? buildFinancialCoachContext(createZeroDashboardData());

      return deterministicCoachResponse({
        capability,
        context,
        userQuestion: prompt.userQuestion
      });
    }
  };
}

export async function persistGeneratedInsights({
  userId,
  client,
  insights
}: {
  userId: string;
  client: AIInsightPrismaClient;
  insights: GeneratedFinancialInsight[];
}) {
  if (insights.length === 0) {
    return 0;
  }

  const result = await client.aiInsight.createMany({
    data: insights.map((insight) => ({
      id: insight.id,
      userId,
      type: insight.type,
      provider: insight.provider,
      model: insight.model,
      promptVersion: insight.promptVersion,
      inputDigest: insight.inputDigest,
      title: insight.title,
      body: insight.body,
      confidence: insight.confidence,
      metadata: insight.metadata
    })),
    skipDuplicates: true
  });

  return result.count;
}

function aggregateHoldings(holdings: HoldingView[]) {
  return [...holdings].sort(
    (left, right) =>
      right.allocationPercent - left.allocationPercent
      || right.currentValueMinor - left.currentValueMinor
      || left.assetName.localeCompare(right.assetName)
  );
}

async function generateFromPrompt({
  prompt,
  provider,
  capability,
  userQuestion,
  asOf,
  model,
  dashboard
}: {
  prompt: InsightPrompt;
  provider: AIProvider;
  capability: FinancialCoachCapability;
  userQuestion?: string;
  asOf: Date;
  model?: string;
  dashboard: LedgerDashboardData;
}) {
  const body = assertInsightSafety(await provider.generateInsight(prompt));
  const inputDigest = digestStable({
    promptVersion: AI_COACH_PROMPT_VERSION,
    type: prompt.type,
    facts: prompt.facts,
    userQuestion
  });
  const contextDigest = digestStable((prompt.facts as { context?: unknown }).context ?? {});
  const type = capabilityConfig(capability).prismaType;

  return {
    id: stableInsightId(type, inputDigest, AI_COACH_PROMPT_VERSION),
    type,
    provider: provider.name,
    model,
    promptVersion: AI_COACH_PROMPT_VERSION,
    inputDigest,
    title: insightTitle(capability, dashboard),
    body,
    confidence: confidenceFor(dashboard),
    metadata: {
      capability,
      contextDigest,
      userQuestion,
      generatedAt: asOf.toISOString()
    }
  };
}

function deterministicCoachResponse({
  capability,
  context,
  userQuestion
}: {
  capability: FinancialCoachCapability;
  context: FinancialCoachContext;
  userQuestion?: string;
}) {
  if (context.portfolioState === "empty") {
    return [
      "There is not enough ledger history yet for a portfolio-specific analysis.",
      "The useful next analytical step is to add transactions, goals, liabilities, and price snapshots so WealthOS can explain progress from actual records."
    ].join(" ");
  }

  const topAllocation = context.allocation[0];
  const topHolding = context.holdings[0];
  const offTrackGoal = context.goals.offTrack[0];
  const alert = context.alerts[0];
  const movement = context.priceMovements[0];

  switch (capability) {
    case "wealth-score":
      return [
        `Wealth score is ${context.wealthScore.score}/100 (${context.wealthScore.grade}).`,
        weakestComponentSentence(context),
        `Net worth is ${formatMinor(context.netWorth.netWorthMinor, context.currency)} after liabilities.`
      ].join(" ");
    case "goal-progress":
    case "goal-tracking":
      return offTrackGoal
        ? `${offTrackGoal.name} is behind schedule because the required monthly funding is ${formatMinor(offTrackGoal.monthlyRequiredMinor, context.currency)} versus current funding of ${formatMinor(offTrackGoal.monthlyContributionMinor, context.currency)}. This is a planning gap analysis, not an instruction.`
        : `Goals are ${formatPercent(context.goals.aggregateProgressPercent)} funded in aggregate. No critical off-track goal is present in the supplied context.`;
    case "retirement-readiness":
      return context.retirement.requiredCorpusMinor > 0
        ? `Retirement readiness is ${formatPercent(context.retirement.readinessPercent)}. The modeled funding gap is ${formatMinor(context.retirement.fundingGapMinor, context.currency)} using the current WealthOS assumptions.`
        : "No retirement profile is available, so readiness analysis is limited to noting that retirement assumptions have not been supplied.";
    case "alerts":
      return alert
        ? `The highest-priority alert is ${alert.severity}: ${alert.title}. Treat it as a diagnostic signal to investigate the underlying ledger or price data.`
        : "There are no unread alerts in the supplied context.";
    case "allocation-risk":
    case "concentration-analysis":
      return topHolding
        ? `${topHolding.assetName} is the largest holding at ${formatPercent(topHolding.allocationPercent)} of assets. Concentration analysis should focus on exposure size, liquidity, and goal alignment without turning that observation into a trade instruction.`
        : "No holdings are available for concentration analysis.";
    case "diversification-analysis":
      return topAllocation
        ? `${topAllocation.assetClass} is the largest allocation at ${formatPercent(topAllocation.allocationPercent)}. Diversification analysis compares this against the full asset-class mix and any user-defined targets.`
        : "No asset allocation exists yet because the portfolio has no valued holdings.";
    case "savings-analysis":
      return `Monthly investment progress is ${formatPercent(context.savings.progressPercent)} based on ${formatMinor(context.savings.actualMonthlyMinor, context.currency)} of ledger activity versus ${formatMinor(context.savings.plannedMonthlyMinor, context.currency)} planned goal funding. Compare complete months for a cleaner savings signal.`;
    case "contextual-answer":
      return [
        userQuestion ? `Question: ${userQuestion}` : "No specific question was supplied.",
        movement
          ? `Recent price-movement context includes ${movement.summary}.`
          : "No recent price-movement alert is present in the supplied context.",
        topAllocation
          ? `The largest allocation is ${topAllocation.assetClass} at ${formatPercent(topAllocation.allocationPercent)}.`
          : "No allocation data is available yet."
      ].join(" ");
  }
}

function extractPriceMovements(alerts: AlertItem[]) {
  return alerts
    .map((alert) => {
      const metadata = objectMetadata(alert.metadata);
      const ruleId = typeof metadata.ruleId === "string" ? metadata.ruleId : undefined;

      if (ruleId === "price-daily-change") {
        return {
          assetId: metadata.assetId as string | undefined,
          symbol: metadata.symbol as string | undefined,
          changePercent: numberMetadata(metadata.changePercent),
          latestPriceMinor: numberMetadata(metadata.latestPriceMinor),
          previousPriceMinor: numberMetadata(metadata.previousPriceMinor),
          asOf: typeof metadata.asOf === "string" ? metadata.asOf : undefined,
          summary: `${alert.title}: ${alert.message}`
        };
      }

      if (alert.title.toLowerCase().includes("moved")) {
        return {
          summary: `${alert.title}: ${alert.message}`
        };
      }

      return undefined;
    })
    .filter((movement): movement is NonNullable<typeof movement> => movement !== undefined)
    .sort((left, right) => (right.changePercent ?? 0) - (left.changePercent ?? 0));
}

type CapabilityConfig = {
  promptType: InsightPrompt["type"];
  prismaType: AIInsightType;
  instruction: string;
  include: string[];
};

function capabilityConfig(capability: FinancialCoachCapability): CapabilityConfig {
  const configs: Record<FinancialCoachCapability, CapabilityConfig> = {
    "wealth-score": {
      promptType: "net-worth",
      prismaType: "NET_WORTH",
      instruction: "Explain the wealth score components and weakest signals.",
      include: ["wealth score", "net worth", "component gaps"]
    },
    "goal-progress": {
      promptType: "goal",
      prismaType: "GOAL",
      instruction: "Explain goal progress and schedule risk.",
      include: ["aggregate progress", "off-track goals", "monthly funding gap"]
    },
    "retirement-readiness": {
      promptType: "retirement",
      prismaType: "RETIREMENT",
      instruction: "Explain retirement readiness from supplied assumptions.",
      include: ["readiness percent", "required corpus", "funding gap"]
    },
    alerts: {
      promptType: "risk",
      prismaType: "RISK_CONCENTRATION",
      instruction: "Summarize active alerts as diagnostic observations.",
      include: ["severity", "alert type", "analysis scope"]
    },
    "allocation-risk": {
      promptType: "risk",
      prismaType: "RISK_CONCENTRATION",
      instruction: "Explain allocation risk without trade instructions.",
      include: ["largest holdings", "asset allocation", "concentration"]
    },
    "diversification-analysis": {
      promptType: "diversification",
      prismaType: "DIVERSIFICATION",
      instruction: "Analyze diversification across asset classes and holdings.",
      include: ["asset-class mix", "dominant exposures", "missing data"]
    },
    "concentration-analysis": {
      promptType: "risk",
      prismaType: "RISK_CONCENTRATION",
      instruction: "Analyze concentration risk across holdings.",
      include: ["largest holding", "allocation percent", "alerts"]
    },
    "savings-analysis": {
      promptType: "discipline",
      prismaType: "INVESTMENT_DISCIPLINE",
      instruction: "Analyze savings and investment discipline.",
      include: ["planned funding", "actual activity", "consistency"]
    },
    "goal-tracking": {
      promptType: "goal",
      prismaType: "GOAL",
      instruction: "Analyze goal tracking status.",
      include: ["progress", "off-track goals", "funding requirements"]
    },
    "contextual-answer": {
      promptType: "net-worth",
      prismaType: "NET_WORTH",
      instruction: "Answer the user's portfolio question using supplied context.",
      include: ["relevant facts", "alerts", "price movements"]
    }
  };

  return configs[capability];
}

function stableInsightId(type: AIInsightType, inputDigest: string, promptVersion: string) {
  return `insight_${digestStable({ type, inputDigest, promptVersion }).slice(0, 24)}`;
}

function insightTitle(capability: FinancialCoachCapability, dashboard: LedgerDashboardData) {
  if (dashboard.netWorth.totalAssetsMinor === 0 && dashboard.transactions.length === 0) {
    return "Portfolio Setup Context";
  }

  const titles: Record<FinancialCoachCapability, string> = {
    "wealth-score": "Wealth Score Explanation",
    "goal-progress": "Goal Progress Explanation",
    "retirement-readiness": "Retirement Readiness Explanation",
    alerts: "Alert Summary",
    "allocation-risk": "Allocation Risk Explanation",
    "diversification-analysis": "Diversification Analysis",
    "concentration-analysis": "Concentration Analysis",
    "savings-analysis": "Savings Analysis",
    "goal-tracking": "Goal Tracking Insight",
    "contextual-answer": "Portfolio Coach Answer"
  };

  return titles[capability];
}

function confidenceFor(dashboard: LedgerDashboardData) {
  if (dashboard.netWorth.totalAssetsMinor === 0 && dashboard.transactions.length === 0) {
    return 0.55;
  }

  if (dashboard.holdings.length > 0 && dashboard.goals.length > 0) {
    return 0.82;
  }

  return 0.72;
}

function weakestComponentSentence(context: FinancialCoachContext) {
  const component = context.wealthScore.weakestComponents[0];
  return component
    ? `${component.name} is the weakest component at ${formatPercent(component.score)}.`
    : "No weak wealth-score component is available in the supplied context.";
}

function compareAlerts(left: AlertItem, right: AlertItem) {
  return severityRank(right.severity) - severityRank(left.severity)
    || right.createdAt.getTime() - left.createdAt.getTime()
    || left.title.localeCompare(right.title);
}

function severityRank(severity: AlertItem["severity"]) {
  const ranks: Record<AlertItem["severity"], number> = {
    Info: 1,
    Warning: 2,
    Critical: 3
  };

  return ranks[severity];
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberMetadata(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : Number(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function digestStable(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function formatMinor(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function formatPercent(value: number) {
  return `${(Math.round(value * 10) / 10).toFixed(1)}%`;
}
