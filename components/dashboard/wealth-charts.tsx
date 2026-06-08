"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCompactMoney, money } from "@/lib/domain/money";

const ALLOCATION_COLORS = ["#0f766e", "#f59e0b", "#7c3aed", "#be123c", "#2563eb", "#525252"];

type TrendPoint = {
  date: string;
  assetsMinor: number;
  liabilitiesMinor: number;
  netWorthMinor: number;
};

type AllocationPoint = {
  assetClass: string;
  valueMinor: number;
  allocationPercent: number;
};

type RetirementPoint = {
  age: number;
  corpusMinor: number;
  inflationAdjustedCorpusMinor: number;
};

export function NetWorthTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-72 min-w-0">
      <ChartReadyFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.24} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e7e1d6" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickFormatter={(value) => formatCompactMoney(money(Number(value)))}
          />
          <Tooltip
            formatter={(value) => formatCompactMoney(money(Number(value)))}
            contentStyle={{ borderRadius: 8, borderColor: "#d8d0c4" }}
          />
          <Area
            type="monotone"
            dataKey="netWorthMinor"
            stroke="#0f766e"
            strokeWidth={3}
            fill="url(#netWorthFill)"
            name="Net Worth"
          />
        </AreaChart>
      </ResponsiveContainer>
      </ChartReadyFrame>
    </div>
  );
}

export function AssetAllocationChart({ data }: { data: AllocationPoint[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <div className="h-56 min-w-0">
        <ChartReadyFrame>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="valueMinor" nameKey="assetClass" innerRadius={58} outerRadius={88} paddingAngle={3}>
              {data.map((entry, index) => (
                <Cell key={entry.assetClass} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatCompactMoney(money(Number(value)))} />
          </PieChart>
        </ResponsiveContainer>
        </ChartReadyFrame>
      </div>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={item.assetClass} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}
              />
              <span className="text-sm font-medium">{item.assetClass}</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">{item.allocationPercent}%</div>
              <div className="text-xs text-muted-foreground">{formatCompactMoney(money(item.valueMinor))}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RetirementProjectionChart({ data }: { data: RetirementPoint[] }) {
  const sampled = data.filter((_, index) => index % 3 === 0 || index === data.length - 1);

  return (
    <div className="h-72 min-w-0">
      <ChartReadyFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sampled} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
          <CartesianGrid stroke="#e7e1d6" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="age" tickLine={false} axisLine={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickFormatter={(value) => formatCompactMoney(money(Number(value)))}
          />
          <Tooltip formatter={(value) => formatCompactMoney(money(Number(value)))} />
          <Bar dataKey="corpusMinor" name="Projected Corpus" fill="#0f766e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="inflationAdjustedCorpusMinor" name="Inflation Adjusted" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      </ChartReadyFrame>
    </div>
  );
}

function ChartReadyFrame({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-full w-full rounded-md bg-muted" />;
  }

  return children;
}
