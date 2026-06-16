import { Brain, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";

const insightCapabilities = [
  "Net Worth Analysis",
  "Goal Analysis",
  "Retirement Analysis",
  "Diversification Analysis",
  "Risk Concentration Analysis",
  "Investment Discipline Analysis"
];

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { insights, wealthScore } = await getCurrentUserDashboardData();

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="AI Insights Hub"
        title="Educational Wealth Analysis"
        description="Provider-agnostic AI insights are layered over deterministic WealthOS facts and constrained to analytical language."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Latest Insights</CardTitle>
            <Badge tone="positive">Policy constrained</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.map((insight) => (
              <article key={insight.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
                      <h2 className="text-sm font-semibold">{insight.title}</h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.body}</p>
                  </div>
                  <Badge>{Math.round(insight.confidence * 100)}%</Badge>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insight Controls</CardTitle>
            <Badge tone="warning">No buy/sell advice</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                Safety Contract
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                AI output is limited to educational observations, concentration flags, and planning analysis.
              </p>
            </div>
            <div>
              <div className="mb-3 text-sm font-semibold">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {insightCapabilities.map((capability) => (
                  <Badge key={capability}>{capability}</Badge>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-sm text-muted-foreground">Wealth score input available to AI</div>
              <div className="mt-1 text-2xl font-semibold">{wealthScore.score}/100</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
