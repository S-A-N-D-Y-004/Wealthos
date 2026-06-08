import { CheckCircle2, FileUp, GitBranch, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brokerImportRegistry } from "@/lib/imports/broker-registry";

const importHistory = [
  { id: "ij-1", source: "CoinDCX", file: "coindcx-trades-june.csv", status: "Validation required", rows: 42 },
  { id: "ij-2", source: "Zerodha Kite", file: "kite-holdings-may.csv", status: "Completed", rows: 18 },
  { id: "ij-3", source: "Angel One", file: "angel-mf-statement.csv", status: "Completed", rows: 33 }
];

export default function ImportsPage() {
  const definitions = Object.values(brokerImportRegistry);

  return (
    <AppShell>
      <ModuleHeader
        eyebrow="CSV Import Center"
        title="Broker Statement Intake"
        description="Upload, preview, map, validate, and deduplicate statements while preserving an import history for auditability."
      />

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Workflow</CardTitle>
            <Badge tone="positive">CSV first</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-primary bg-emerald-50 p-6 text-center">
              <FileUp className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
              <div className="mt-3 font-semibold">Drop a statement CSV</div>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                The API preview endpoint validates required columns and flags duplicate rows before import.
              </p>
              <Button className="mt-4">
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Select CSV
              </Button>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-muted p-3">
                <CheckCircle2 className="mb-2 h-4 w-4 text-primary" aria-hidden="true" />
                Preview
              </div>
              <div className="rounded-lg bg-muted p-3">
                <ShieldAlert className="mb-2 h-4 w-4 text-amber-600" aria-hidden="true" />
                Validate
              </div>
              <div className="rounded-lg bg-muted p-3">
                <GitBranch className="mb-2 h-4 w-4 text-violet-600" aria-hidden="true" />
                Import
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported Sources</CardTitle>
            <Badge tone="neutral">{definitions.length} registries</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {definitions.map((definition) => (
                <div key={definition.source} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{definition.displayName}</div>
                    <Badge tone="positive">{definition.supportedModes.join(", ")}</Badge>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Required: {definition.requiredColumns.join(", ")}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Import History</CardTitle>
          <Badge tone="neutral">Audit log</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Source</th>
                  <th className="py-3 pr-4 font-semibold">File</th>
                  <th className="py-3 pr-4 text-right font-semibold">Rows</th>
                  <th className="py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((job) => (
                  <tr key={job.id} className="border-b border-border last:border-0">
                    <td className="py-4 pr-4 font-semibold">{job.source}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{job.file}</td>
                    <td className="py-4 pr-4 text-right">{job.rows}</td>
                    <td className="py-4 text-right">
                      <Badge tone={job.status === "Completed" ? "positive" : "warning"}>{job.status}</Badge>
                    </td>
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

