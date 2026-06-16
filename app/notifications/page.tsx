import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";

const channels = [
  { label: "In-App", icon: Bell, status: "Enabled" },
  { label: "Email", icon: Mail, status: "Ready" },
  { label: "Push", icon: Smartphone, status: "Planned" },
  { label: "Telegram", icon: MessageCircle, status: "Future" }
];

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { alerts } = await getCurrentUserDashboardData();

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Notifications"
        title="Alert Routing"
        description="Goal, retirement, portfolio, import, and system alerts are modeled for in-app, email, push, and future Telegram delivery."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
            <Badge tone="warning">{alerts.length} open</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts.map((alert) => (
              <article key={alert.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">{alert.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                  </div>
                  <Badge tone={alert.severity === "Warning" ? "warning" : "neutral"}>{alert.type}</Badge>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channels</CardTitle>
            <Badge tone="neutral">Extensible</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <div key={channel.label} className="rounded-lg border border-border p-4">
                  <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                  <div className="font-semibold">{channel.label}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{channel.status}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
