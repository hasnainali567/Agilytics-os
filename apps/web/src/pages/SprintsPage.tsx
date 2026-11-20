import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "../components/layout";
import { Card, CardHeader, Field, Input, Select, StatusPill } from "../components/ui";
import { createSprint, fetchProjects, fetchSprints } from "../lib/api";

/** Sprints — Kanban main design: white 18px cards on the #E9EEF5 page,
 *  create form on the shared Input/Select primitives with a vivid
 *  purple #6C5CE7 submit button, and a 13px table (muted uppercase
 *  headers, hairline dividers, 11–12px status pills) for the list.
 *  List from GET /sprints, create via POST /sprints. A sprint belongs
 *  to a project, so the form picks one from GET /projects. */
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
    <div className="flex min-h-full flex-col bg-[#E9EEF5]">
      <TopBar title="Sprints" />
      <main className="space-y-5 px-6 py-6 lg:px-8">
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
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-[10px] bg-[#6C5CE7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#5B4BD6] disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create sprint"}
            </button>
            {formError ? <p className="w-full text-sm text-risk">{formError}</p> : null}
          </form>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="All sprints" subtitle={`${sprints.length} sprint${sprints.length === 1 ? "" : "s"}`} />
          {sprintsQuery.isPending ? (
            <p className="p-5 text-sm text-muted">Loading sprints…</p>
          ) : sprintsQuery.isError || !sprintsQuery.data ? (
            <p className="p-5 text-sm text-muted">
              The sprints API isn't reachable yet — start the API and sign in.
            </p>
          ) : sprints.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No sprints yet — create your first one above.
            </p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Sprint</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Goal</th>
                  <th className="px-5 py-3 font-medium">Dates</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sprints.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-[#F7F8FA]">
                    <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                    <td className="px-5 py-3 text-muted">{projectName(s.projectId)}</td>
                    <td className="px-5 py-3 text-muted">
                      {s.goal ? (
                        <span className="block max-w-md truncate">{s.goal}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted">
                      {new Date(s.startDate).toLocaleDateString()} —{" "}
                      {new Date(s.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </div>
  );
}
