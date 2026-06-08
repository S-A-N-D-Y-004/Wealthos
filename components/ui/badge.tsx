import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "warning" | "critical";
};

const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-rose-200 bg-rose-50 text-rose-700"
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

