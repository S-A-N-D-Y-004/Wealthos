import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { RetirementProjectionChart } from "@/components/dashboard/wealth-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { retirementProjection } from "@/lib/data/mock-wealth";
import { formatCompactMoney, money } from "@/lib/domain/money";

export default function RetirementPage() {
  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Retirement Planner"
        title="Corpus Readiness"
        description="Scenario inputs compound monthly contributions, inflation, expected returns, and safe withdrawal assumptions into deterministic projections."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Future Corpus" value={money(retirementProjection.futureCorpusMinor)} trend="nominal" tone="positive" />
        <MetricCard label="Inflation Adjusted" value={money(retirementProjection.inflationAdjustedCorpusMinor)} trend="real" />
        <MetricCard label="Required Corpus" value={money(retirementProjection.requiredCorpusMinor)} trend="target" tone="warning" />
        <MetricCard label="Readiness" value={`${retirementProjection.readinessPercent}%`} trend={`${retirementProjection.yearsToRetirement} yrs`} tone="positive" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projection</CardTitle>
            <Badge tone="neutral">Monthly compounding</Badge>
          </CardHeader>
          <CardContent>
            <RetirementProjectionChart data={retirementProjection.yearlyProjection} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <Badge tone="warning">Review annually</Badge>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Current Age</dt>
                <dd className="font-semibold">{retirementProjection.currentAge}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Retirement Age</dt>
                <dd className="font-semibold">{retirementProjection.retirementAge}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Monthly Contribution</dt>
                <dd className="font-semibold">{formatCompactMoney(money(retirementProjection.monthlyContributionMinor))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Inflation</dt>
                <dd className="font-semibold">{(retirementProjection.inflationRate * 100).toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Expected Return</dt>
                <dd className="font-semibold">{(retirementProjection.expectedAnnualReturnRate * 100).toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Safe Withdrawal</dt>
                <dd className="font-semibold">{(retirementProjection.safeWithdrawalRate * 100).toFixed(1)}%</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

