"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  selectAnalyticsTimeRange,
  type AnalyticsAllocationPoint,
  type AnalyticsDashboardData,
  type AnalyticsDashboardTimeRangeKey,
  type AnalyticsMonthlyReturnPoint,
  type AnalyticsTrendPoint
} from "@/lib/dashboard/analytics-dashboard";
import { formatCompactMoney, money } from "@/lib/domain/money";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#0f766e", "#f59e0b", "#2563eb", "#be123c", "#7c3aed", "#525252", "#0891b2", "#a16207"];

export function PortfolioAnalyticsDashboard({ data }: { data: AnalyticsDashboardData }) {
  const [activeRangeKey, setActiveRangeKey] = useState<AnalyticsDashboardTimeRangeKey>(data.defaultRangeKey);
  const activeRange = useMemo(
    () => selectAnalyticsTimeRange(data, activeRangeKey),
    [activeRangeKey, data]
  );

  if (data.isEmpty) {
    return <AnalyticsEmptyState />;
  }

  return (
    <div className="space-y-4" data-testid="portfolio-analytics-dashboard">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Analytics time range">
          {data.rangeOptions.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={activeRange.key === option.key ? "primary" : "secondary"}
              role="tab"
              aria-selected={activeRange.key === option.key}
              className="h-9"
              onClick={() => setActiveRangeKey(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="text-sm text-muted-foreground" aria-live="polite">
          {formatDate(activeRange.period.startDateIso)} to {formatDate(activeRange.period.endDateIso)}
        </div>
      </div>

      {activeRange.key === "CUSTOM" ? (
        <div className="grid gap-3 rounded-lg border border-border bg-white p-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Start
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm font-medium text-foreground"
              type="date"
              value={dateInputValue(activeRange.period.startDateIso)}
              readOnly
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            End
            <input
              className="mt-2 h-10 w-full rounded-md border border-border bg-muted px-3 text-sm font-medium text-foreground"
              type="date"
              value={dateInputValue(activeRange.period.endDateIso)}
              readOnly
            />
          </label>
        </div>
      ) : null}

      <section aria-labelledby="analytics-overview-heading">
        <h2 id="analytics-overview-heading" className="sr-only">Overview Cards</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Current Portfolio Value"
            value={money(activeRange.overview.currentPortfolioValueMinor)}
            trend={formatPercent(activeRange.overview.absoluteReturnPercent)}
            tone={toneForPercent(activeRange.overview.absoluteReturnPercent)}
          />
          <MetricCard label="Total Invested" value={money(activeRange.overview.totalInvestedMinor)} />
          <MetricCard
            label="Total Gain/Loss"
            value={money(activeRange.overview.totalGainLossMinor)}
            trend={formatPercent(activeRange.overview.absoluteReturnPercent)}
            tone={toneForPercent(activeRange.overview.totalGainLossMinor)}
          />
          <MetricCard
            label="Absolute Return"
            value={formatPercent(activeRange.overview.absoluteReturnPercent)}
            tone={toneForPercent(activeRange.overview.absoluteReturnPercent)}
          />
          <MetricCard
            label="CAGR"
            value={formatPercent(activeRange.overview.cagrPercent)}
            tone={toneForPercent(activeRange.overview.cagrPercent)}
          />
          <MetricCard
            label="XIRR"
            value={formatPercent(activeRange.overview.xirrPercent)}
            tone={toneForPercent(activeRange.overview.xirrPercent)}
          />
          <MetricCard
            label="Money-Weighted Return"
            value={formatPercent(activeRange.overview.moneyWeightedReturnPercent)}
            tone={toneForPercent(activeRange.overview.moneyWeightedReturnPercent)}
          />
          <MetricCard
            label="Annualized Return"
            value={formatPercent(activeRange.overview.annualizedReturnPercent)}
            tone={toneForPercent(activeRange.overview.annualizedReturnPercent)}
          />
        </div>
      </section>

      <section aria-labelledby="analytics-risk-heading">
        <h2 id="analytics-risk-heading" className="sr-only">Risk Cards</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Risk Rating" value={activeRange.risk.riskRating} tone={toneForRisk(activeRange.risk.riskRating)} />
          <MetricCard label="Diversification Score" value={`${activeRange.risk.diversificationScore}/100`} />
          <MetricCard label="Volatility" value={formatPercent(activeRange.risk.volatilityPercent)} />
          <MetricCard label="Maximum Drawdown" value={formatPercent(activeRange.risk.maximumDrawdownPercent)} tone="warning" />
          <MetricCard label="Largest Holding" value={formatPercent(activeRange.risk.largestHoldingPercent)} />
          <MetricCard label="Concentration Level" value={activeRange.risk.concentrationLevel} tone={toneForConcentration(activeRange.risk.concentrationLevel)} />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Portfolio Growth" badge={activeRange.label}>
          <PortfolioGrowthChart data={activeRange.charts.portfolioGrowth} />
        </ChartCard>
        <ChartCard title="Net Worth History" badge="Assets and liabilities">
          <NetWorthHistoryChart data={activeRange.charts.netWorthHistory} />
        </ChartCard>
        <ChartCard title="Monthly Returns" badge="Period change">
          <MonthlyReturnsChart data={activeRange.charts.monthlyReturns} />
        </ChartCard>
        <ChartCard title="Asset Allocation" badge={`${data.allocations.assetClasses.length} classes`}>
          <AllocationPieChart data={activeRange.charts.assetAllocation} ariaLabel="Asset allocation chart" />
        </ChartCard>
        <ChartCard title="Portfolio Allocation" badge="Top positions">
          <AllocationPieChart data={activeRange.charts.portfolioAllocation} ariaLabel="Portfolio allocation chart" />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle>Top Holdings</CardTitle>
            <Badge tone="neutral">{data.allocations.topHoldings.length} positions</Badge>
          </CardHeader>
          <CardContent>
            <TopHoldingsTable holdings={data.allocations.topHoldings} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AllocationList title="Asset Classes" items={data.allocations.assetClasses} />
        <AllocationList title="Broker Allocation" items={data.allocations.brokerAllocation} />
        <AllocationList title="Portfolio Composition" items={data.allocations.portfolioComposition} />
      </div>
    </div>
  );
}

function AnalyticsEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio analytics will appear after your first import</CardTitle>
        <Badge tone="neutral">Zero state</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Import investments to populate return, risk, allocation, and portfolio history analytics from ledger transactions.
        </p>
        <a
          href="/imports"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Open Imports
        </a>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  badge,
  children
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone="neutral">{badge}</Badge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PortfolioGrowthChart({ data }: { data: AnalyticsTrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyChartState label="No portfolio history yet" />;
  }

  return (
    <ChartFrame ariaLabel="Portfolio growth chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrowthFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.26} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e7e1d6" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={formatChartMoney} />
          <Tooltip formatter={(value) => formatCompactMoney(money(Number(value)))} contentStyle={{ borderRadius: 8, borderColor: "#d8d0c4" }} />
          <Area type="monotone" dataKey="portfolioValueMinor" stroke="#0f766e" strokeWidth={3} fill="url(#portfolioGrowthFill)" name="Portfolio Value" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function NetWorthHistoryChart({ data }: { data: AnalyticsTrendPoint[] }) {
  if (data.length === 0) {
    return <EmptyChartState label="No net worth history yet" />;
  }

  return (
    <ChartFrame ariaLabel="Net worth history chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e7e1d6" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={formatChartMoney} />
          <Tooltip formatter={(value) => formatCompactMoney(money(Number(value)))} contentStyle={{ borderRadius: 8, borderColor: "#d8d0c4" }} />
          <Line type="monotone" dataKey="assetsMinor" name="Assets" stroke="#0f766e" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="liabilitiesMinor" name="Liabilities" stroke="#be123c" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="netWorthMinor" name="Net Worth" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function MonthlyReturnsChart({ data }: { data: AnalyticsMonthlyReturnPoint[] }) {
  if (data.length === 0) {
    return <EmptyChartState label="No monthly return history yet" />;
  }

  return (
    <ChartFrame ariaLabel="Monthly returns chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e7e1d6" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={(value) => `${value}%`} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} contentStyle={{ borderRadius: 8, borderColor: "#d8d0c4" }} />
          <Bar dataKey="returnPercent" name="Monthly Return" radius={[4, 4, 0, 0]}>
            {data.map((point) => (
              <Cell key={point.date} fill={point.returnPercent >= 0 ? "#0f766e" : "#be123c"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

function AllocationPieChart({
  data,
  ariaLabel
}: {
  data: AnalyticsAllocationPoint[];
  ariaLabel: string;
}) {
  if (data.length === 0) {
    return <EmptyChartState label="No allocation data yet" />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <ChartFrame ariaLabel={ariaLabel} className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="valueMinor" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCompactMoney(money(Number(value)))} />
          </PieChart>
        </ResponsiveContainer>
      </ChartFrame>
      <AllocationLegend items={data} />
    </div>
  );
}

function ChartFrame({
  children,
  ariaLabel,
  className
}: {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("h-72 min-w-0", className)} aria-label={ariaLabel}>
      {mounted ? children : <div className="h-full w-full rounded-md bg-muted" />}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="grid h-72 place-items-center rounded-md border border-dashed border-border bg-muted px-4 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function AllocationLegend({ items }: { items: AnalyticsAllocationPoint[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="text-sm font-medium">{item.name}</span>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{formatPercent(item.allocationPercent)}</div>
            <div className="text-xs text-muted-foreground">{formatCompactMoney(money(item.valueMinor))}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AllocationList({ title, items }: { title: string; items: AnalyticsAllocationPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone="neutral">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No allocation data yet.</p>
        ) : items.map((item, index) => (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  aria-hidden="true"
                />
                {item.name}
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatPercent(item.allocationPercent)}</div>
                <div className="text-xs text-muted-foreground">{formatCompactMoney(money(item.valueMinor))}</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(item.allocationPercent, 100)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TopHoldingsTable({ holdings }: { holdings: AnalyticsDashboardData["allocations"]["topHoldings"] }) {
  if (holdings.length === 0) {
    return <p className="text-sm text-muted-foreground">No holdings yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase text-muted-foreground">
            <th className="py-3 pr-4 font-semibold">Holding</th>
            <th className="py-3 pr-4 font-semibold">Broker</th>
            <th className="py-3 pr-4 font-semibold">Class</th>
            <th className="py-3 pr-4 text-right font-semibold">Value</th>
            <th className="py-3 pr-4 text-right font-semibold">Gain/Loss</th>
            <th className="py-3 text-right font-semibold">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.id} className="border-b border-border last:border-0">
              <td className="py-4 pr-4">
                <div className="font-semibold">{holding.assetName}</div>
                <div className="text-xs text-muted-foreground">{holding.symbol ?? holding.assetType}</div>
              </td>
              <td className="py-4 pr-4 text-muted-foreground">{holding.source}</td>
              <td className="py-4 pr-4">
                <Badge>{holding.assetClass}</Badge>
              </td>
              <td className="py-4 pr-4 text-right font-semibold">{formatCompactMoney(money(holding.currentValueMinor))}</td>
              <td className={cn("py-4 pr-4 text-right", holding.gainLossMinor >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {formatCompactMoney(money(holding.gainLossMinor))} ({formatPercent(holding.gainLossPercent)})
              </td>
              <td className="py-4 text-right">{formatPercent(holding.allocationPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toneForPercent(value: number) {
  if (value > 0) {
    return "positive" as const;
  }

  if (value < 0) {
    return "critical" as const;
  }

  return "neutral" as const;
}

function toneForRisk(value: string) {
  if (value === "Very High" || value === "High") {
    return "critical" as const;
  }

  if (value === "Moderate") {
    return "warning" as const;
  }

  return "positive" as const;
}

function toneForConcentration(value: string) {
  if (value === "High") {
    return "critical" as const;
  }

  if (value === "Moderate") {
    return "warning" as const;
  }

  return "positive" as const;
}

function formatChartMoney(value: number | string) {
  return formatCompactMoney(money(Number(value)));
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Inception";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function dateInputValue(value: string | undefined) {
  return value?.slice(0, 10) ?? "";
}
