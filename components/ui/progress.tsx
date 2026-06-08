import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  className?: string;
};

export function Progress({ value, className }: ProgressProps) {
  const normalized = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-sm bg-muted", className)}>
      <div
        className="h-full rounded-sm bg-primary transition-all"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

