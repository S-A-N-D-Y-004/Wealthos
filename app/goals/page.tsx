import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { formatCompactMoney, money } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const { goalSummary } = await getCurrentUserDashboardData();

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Goal Planner"
        title="Funding Roadmap"
        description="Emergency fund, house, vehicle, retirement, and custom goals with progress, estimated completion, and funding gaps."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {goalSummary.forecasts.map((goal) => (
          <Card key={goal.id}>
            <CardHeader>
              <CardTitle>{goal.name}</CardTitle>
              <Badge tone={goal.isOnTrack ? "positive" : "warning"}>{goal.priority}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={goal.progressPercent} />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Progress</div>
                  <div className="text-lg font-semibold">{goal.progressPercent}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Funding Gap</div>
                  <div className="text-lg font-semibold">{formatCompactMoney(money(goal.fundingGapMinor))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Monthly Required</div>
                  <div className="text-lg font-semibold">{formatCompactMoney(money(goal.monthlyRequiredMinor))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Target Date</div>
                  <div className="text-lg font-semibold">
                    {goal.targetDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Estimated completion:{" "}
                {goal.estimatedCompletionDate
                  ? goal.estimatedCompletionDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                  : "not available until monthly funding is set"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
