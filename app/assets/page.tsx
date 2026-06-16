import { Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentUserDashboardData } from "@/lib/dashboard/ledger-dashboard";
import { formatCompactMoney, money } from "@/lib/domain/money";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const { holdings, netWorth } = await getCurrentUserDashboardData();

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="Assets"
        title="Investment Inventory"
        description="Searchable holdings across stocks, ETFs, mutual funds, crypto, gold, cash, and fixed deposits with cost basis and allocation visibility."
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-muted-foreground">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input className="w-full bg-transparent outline-none" placeholder="Search holdings, symbols, accounts" />
        </label>
        <Button variant="secondary">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <Badge tone="neutral">{holdings.length} positions</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Asset</th>
                  <th className="py-3 pr-4 font-semibold">Account</th>
                  <th className="py-3 pr-4 font-semibold">Type</th>
                  <th className="py-3 pr-4 text-right font-semibold">Quantity</th>
                  <th className="py-3 pr-4 text-right font-semibold">Cost Basis</th>
                  <th className="py-3 pr-4 text-right font-semibold">Current Value</th>
                  <th className="py-3 pr-4 text-right font-semibold">Gain/Loss</th>
                  <th className="py-3 text-right font-semibold">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {netWorth.holdings.map((holding) => (
                  <tr key={holding.id} className="border-b border-border last:border-0">
                    <td className="py-4 pr-4">
                      <div className="font-semibold">{holding.assetName}</div>
                      <div className="text-xs text-muted-foreground">{holding.symbol ?? holding.assetClass}</div>
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">{holding.accountName}</td>
                    <td className="py-4 pr-4">
                      <Badge>{holding.assetType}</Badge>
                    </td>
                    <td className="py-4 pr-4 text-right">{holding.quantity.toLocaleString("en-IN")}</td>
                    <td className="py-4 pr-4 text-right">{formatCompactMoney(money(holding.costBasisMinor))}</td>
                    <td className="py-4 pr-4 text-right font-semibold">
                      {formatCompactMoney(money(holding.currentValueMinor))}
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <span className={holding.gainLossMinor >= 0 ? "text-emerald-700" : "text-rose-700"}>
                        {formatCompactMoney(money(holding.gainLossMinor))} · {holding.gainLossPercent}%
                      </span>
                    </td>
                    <td className="py-4 text-right">{holding.allocationPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
