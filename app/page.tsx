import { AppShell } from "@/components/app-shell";
import { AssetAllocationChart, NetWorthTrendChart } from "@/components/dashboard/wealth-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  activities,
  goalSummary,
  monthlyInvestmentProgress,
  netWorth,
  netWorthTrend,
  retirementProjection,
  wealthScore
} from "@/lib/data/mock-wealth";
import { formatCompactMoney, money } from "@/lib/domain/money";

export default function DashboardPage() {
  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Wealth Command Center"
        title="Today’s Wealth Position"
        description="Consolidated net worth, allocation, retirement readiness, goal progress, and investment discipline across accounts."
        status="Manual + CSV foundation"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <MetricCard
            label="Current Net Worth"
            value={money(netWorth.netWorthMinor)}
            trend="+7.4% QoQ"
            tone="positive"
          />
        </div>
        <MetricCard label="Total Assets" value={money(netWorth.totalAssetsMinor)} trend="+5.1%" tone="positive" />
        <MetricCard label="Liabilities" value={money(netWorth.totalLiabilitiesMinor)} trend="-1.8%" tone="positive" />
        <MetricCard label="Wealth Health" value={`${wealthScore.score}/100`} trend={wealthScore.grade} tone="positive" />
        <MetricCard
          label="Retirement Readiness"
          value={`${retirementProjection.readinessPercent}%`}
          trend={`${retirementProjection.yearsToRetirement} yrs`}
          tone={retirementProjection.readinessPercent >= 85 ? "positive" : "warning"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Net Worth Trend</CardTitle>
            <Badge tone="neutral">Historical snapshots</Badge>
          </CardHeader>
          <CardContent>
            <NetWorthTrendChart data={netWorthTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asset Allocation</CardTitle>
            <Badge tone="warning">Policy drift watched</Badge>
          </CardHeader>
          <CardContent>
            <AssetAllocationChart data={netWorth.assetAllocation} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Goal Progress</CardTitle>
            <span className="text-sm font-semibold">{goalSummary.aggregateProgressPercent}%</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={goalSummary.aggregateProgressPercent} />
            <div className="space-y-3">
              {goalSummary.forecasts.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{goal.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Gap {formatCompactMoney(money(goal.fundingGapMinor))}
                    </div>
                  </div>
                  <Badge tone={goal.isOnTrack ? "positive" : "warning"}>{goal.progressPercent}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Investment Progress</CardTitle>
            <Badge tone="positive">{monthlyInvestmentProgress.progressPercent}%</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={monthlyInvestmentProgress.progressPercent} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Planned</div>
                <div className="text-lg font-semibold">
                  {formatCompactMoney(money(monthlyInvestmentProgress.plannedMinor))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Actual</div>
                <div className="text-lg font-semibold">
                  {formatCompactMoney(money(monthlyInvestmentProgress.actualMinor))}
                </div>
              </div>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Investment discipline is scored from scheduled contributions, import recency, and missed-month detection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <Badge tone="neutral">Audit trail</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activities.map((activity) => (
                <div key={activity.id} className="border-l-2 border-primary pl-3">
                  <div className="text-sm font-semibold">
                    {activity.action} · {activity.entity}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{activity.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

