import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { PortfolioAnalyticsDashboard } from "@/components/dashboard/portfolio-analytics-dashboard";
import { buildAnalyticsDashboardData } from "@/lib/dashboard/analytics-dashboard";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const dashboard = await getCurrentUserDashboardData();
  const analytics = buildAnalyticsDashboardData(dashboard);

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Portfolio Analytics"
        title="Returns, Risk, and Allocation"
        description="Ledger-backed analytics for portfolio performance, risk concentration, allocation, and net worth history."
        status="Analytics engine"
      />
      <PortfolioAnalyticsDashboard data={analytics} />
    </AppShell>
  );
}
