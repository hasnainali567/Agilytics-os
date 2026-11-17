import { useQuery } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Card, CardHeader } from "../components/ui";
import { VelocityChart } from "../components/VelocityChart";
import { fetchDashboardSummary } from "../lib/api";

/** Reports page — Pin 3 DealDeck layout. Real data from the reporting API. */
export function ReportsPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
    retry: false,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title="Reports" />
      <main className="space-y-4 p-6">
        {isPending ? (
          <Card className="p-6 text-sm text-muted">Loading reports…</Card>
        ) : isError || !data ? (
          <Card className="p-6 text-sm text-muted">
            Reports need the API running — see the Home page for how to start it.
          </Card>
        ) : (
          <VelocityChart data={data.velocity} />
        )}
        <Card>
          <CardHeader title="Weekly report" subtitle="Rebuilt on the v2 API in Phase 2" />
          <p className="p-5 text-sm text-muted">
            Per-project and per-member reports, burndown, and export will live here.
          </p>
        </Card>
      </main>
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar title={title} />
      <main className="p-6">
        <Card>
          <CardHeader title={title} subtitle="Placeholder — built in a later slice" />
          <p className="p-5 text-sm text-muted">
            This section is intentionally empty in the scaffold.
          </p>
        </Card>
      </main>
    </div>
  );
}
