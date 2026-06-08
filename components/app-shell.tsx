"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Bell,
  Brain,
  CircleDollarSign,
  FileUp,
  Flag,
  Gauge,
  Landmark,
  LineChart,
  type LucideIcon,
  PieChart,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Command", icon: Gauge },
  { href: "/assets", label: "Assets", icon: PieChart },
  { href: "/net-worth", label: "Net Worth", icon: CircleDollarSign },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/retirement", label: "Retirement", icon: LineChart },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/insights", label: "AI Insights", icon: Brain },
  { href: "/notifications", label: "Alerts", icon: Bell }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-white/86 px-4 py-5 backdrop-blur lg:block">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-foreground text-white">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-semibold leading-5">WealthOS</span>
            <span className="text-xs text-muted-foreground">Personal terminal</span>
          </span>
        </Link>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition",
                  active ? "bg-foreground text-white" : "hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Data Integrity
          </div>
          <p className="mt-2 text-xs leading-5 text-emerald-700">
            Deterministic engines are isolated from AI and presentation layers.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-white/88 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Landmark className="h-5 w-5" aria-hidden="true" />
            WealthOS
          </Link>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-xs font-medium",
                  active ? "bg-foreground text-white" : "bg-muted text-muted-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
