import { Badge } from "@/components/ui/badge";

type ModuleHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  status?: string;
};

export function ModuleHeader({ eyebrow, title, description, status }: ModuleHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-primary">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {status ? <Badge tone="positive">{status}</Badge> : null}
    </div>
  );
}

