import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Button, Card, CardHeader, Field, Input, Select, StatusPill } from "../components/ui";
import { createSprint, fetchProjects, fetchSprints } from "../lib/api";

/** Sprints — list from GET /sprints, create via POST /sprints.
 *  A sprint belongs to a project, so the form picks one from GET /projects. */
export function SprintsPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    retry: false,
  });
  const sprintsQuery = useQuery({
    queryKey: ["sprints"],
    queryFn: fetchSprints,
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      createSprint({
        projectId,
        name: name.trim(),
        goal: goal.trim() || undefined,
        startDate,
        endDate,
      }),
    onSuccess: () => {
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["sprints"] });
    },
    onError: (err) => setFormError(err.message),
  });

  const projects = projectsQuery.data ?? [];
  const sprints = sprintsQuery.data ?? [];
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Unknown project";

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Sprints" />
      <main className="space-y-4 p-6">
        <Card>
          <CardHeader title="New sprint" subtitle="Sprints group a project's work into a time box." />
          <form
            className="flex flex-wrap items-end gap-3 px-5 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              if (!projectId) {
                setFormError("Pick a project first.");
                return;
              }
              if (!startDate || !endDate) {
                setFormError("Pick a start and an end date.");
                return;
              }
              if (endDate <= startDate) {
                setFormError("End date must be after the start date.");
                return;
              }
              create.mutate();
            }}
          >
            <Field label="Project" className="w-56">
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                aria-label="Project"
              >
                <option value="">
                  {projectsQuery.isPending ? "Loading projects…" : "Select a project"}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name" className="w-48">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sprint 1"
                className="w-full"
              />
            </Field>
            <Field label="Goal" className="w-64">
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="What this sprint delivers"
                className="w-full"
              />
            </Field>
            <Field label="Start">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </Field>
            <Field label="End">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </Field>
            <Button>Create sprint</Button>
            {formError ? <p className="w-full text-sm text-red-700">{formError}</p> : null}
          </form>
        </Card>

        {sprintsQuery.isPending ? (
          <Card className="p-6 text-sm text-muted">Loading sprints…</Card>
        ) : sprintsQuery.isError || !sprintsQuery.data ? (
          <Card className="p-6 text-sm text-muted">
            The sprints API isn't reachable yet — start the API and sign in.
          </Card>
        ) : sprints.length === 0 ? (
          <Card className="p-6 text-sm text-muted">
            No sprints yet — create your first one above.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sprints.map((s) => (
              <Card key={s.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                    <p className="mt-0.5 text-xs text-muted">{projectName(s.projectId)}</p>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                {s.goal ? <p className="mt-3 text-sm text-muted">{s.goal}</p> : null}
                <p className="mt-3 text-xs text-muted">
                  {new Date(s.startDate).toLocaleDateString()} —{" "}
                  {new Date(s.endDate).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
