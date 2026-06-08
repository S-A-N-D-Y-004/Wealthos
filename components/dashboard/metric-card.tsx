import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCompactMoney, type Money } from "@/lib/domain/money";

type MetricCardProps = {
  label: string;
  value: Money | string | number;
  trend?: string;
  tone?: "neutral" | "positive" | "warning" | "critical";
};

export function MetricCard({ label, value, trend, tone = "neutral" }: MetricCardProps) {
  const Icon = tone === "positive" ? ArrowUpRight : tone === "critical" ? ArrowDownRight : Minus;
  const displayValue =
    typeof value === "object" && "amountMinor" in value ? formatCompactMoney(value) : value;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
        {trend ? (
          <Badge tone={tone === "neutral" ? "positive" : tone}>
            <Icon className="mr-1 h-3 w-3" aria-hidden="true" />
            {trend}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-normal text-foreground">{displayValue}</div>
      </CardContent>
    </Card>
  );
}

