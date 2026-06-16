import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { NetWorthTrendChart } from "@/components/dashboard/wealth-charts";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { formatCompactMoney, money } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const { liabilities, netWorth, netWorthTrend } = await getCurrentUserDashboardData();

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Net Worth"
        title="Assets Minus Liabilities"
        description="Historical snapshots preserve net worth growth over time and keep liability impact visible alongside investments."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Assets" value={money(netWorth.totalAssetsMinor)} trend="+5.1%" tone="positive" />
        <MetricCard label="Liabilities" value={money(netWorth.totalLiabilitiesMinor)} trend="-1.8%" tone="positive" />
        <MetricCard label="Net Worth" value={money(netWorth.netWorthMinor)} trend="+7.4% QoQ" tone="positive" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Snapshot Trend</CardTitle>
            <Badge tone="neutral">Monthly</Badge>
          </CardHeader>
          <CardContent>
            <NetWorthTrendChart data={netWorthTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liabilities</CardTitle>
            <Badge tone="warning">Repayment tracked</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {liabilities.map((liability) => (
              <div key={liability.id} className="flex items-center justify-between gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
                <div>
                  <div className="font-semibold">{liability.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {liability.interestRate ? `${(liability.interestRate * 100).toFixed(1)}% APR` : liability.type}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCompactMoney(money(liability.outstandingMinor))}</div>
                  {liability.emiMinor ? (
                    <div className="text-xs text-muted-foreground">
                      EMI {formatCompactMoney(money(liability.emiMinor))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
