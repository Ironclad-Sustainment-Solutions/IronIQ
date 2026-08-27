import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PageHeader,
  Panel,
  EmptyState,
} from "@/components/ironiq/layout-primitives";
import {
  JobStatusBadge,
  StageBadge,
} from "@/components/ironiq/production-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/context/app-context";
import { useJobs } from "@/lib/production-api";
import {
  AI_STATEMENT,
  BLOCKING_STATUSES,
  JOB_STATUS_META,
  PRODUCTION_STAGES,
  type ProductionStage,
} from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/production/")({
  head: () => ({
    meta: [
      { title: "Production Flow — IronIQ CNC Job Queue" },
      {
        name: "description",
        content:
          "Track CNC jobs from customer intake through AI manufacturing planning, programming, simulation, programmer approval and customer release.",
      },
      {
        property: "og:title",
        content: "Production Flow — IronIQ CNC Job Queue",
      },
      {
        property: "og:description",
        content:
          "Intake to release visibility for every CNC programming job in IronIQ.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductionQueue,
});

function ProductionQueue() {
  const { organization } = useApp();
  const { data: jobs = [], isLoading } = useJobs(organization?.id);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<ProductionStage | "all">("all");

  const filtered = useMemo(
    () =>
      jobs.filter((job) => {
        const meta = JOB_STATUS_META[job.status];
        if (stage !== "all" && meta.stage !== stage) return false;
        const haystack =
          `${job.job_number} ${job.part_number ?? ""} ${job.part_name ?? ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [jobs, search, stage],
  );

  const stageCounts = PRODUCTION_STAGES.map((s) => ({
    stage: s,
    count: jobs.filter((job) => JOB_STATUS_META[job.status].stage === s).length,
  }));
  const blocked = jobs.filter((job) =>
    BLOCKING_STATUSES.includes(job.status),
  ).length;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Production Flow"
          title="CNC Job Queue"
          description="Customer intake through AI-assisted planning, programming, verification, approval and release."
          actions={
            <Button asChild>
              <Link to="/production/new">Submit job</Link>
            </Button>
          }
        />

        <p className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {AI_STATEMENT}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="panel p-4">
            <p className="eyebrow">Active jobs</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {jobs.length}
            </p>
          </div>
          <div className="panel p-4">
            <p className="eyebrow">Blocked / exception</p>
            <p className="mt-1 font-display text-3xl font-bold text-destructive">
              {blocked}
            </p>
          </div>
          <div className="panel p-4">
            <p className="eyebrow">Awaiting programmer</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {
                jobs.filter((j) =>
                  [
                    "programmer_plan_review",
                    "programmer_approval_pending",
                    "posted_code_review",
                  ].includes(j.status),
                ).length
              }
            </p>
          </div>
          <div className="panel p-4">
            <p className="eyebrow">Released</p>
            <p className="mt-1 font-display text-3xl font-bold">
              {
                jobs.filter((j) =>
                  [
                    "released_to_customer",
                    "customer_prove_out",
                    "completed",
                  ].includes(j.status),
                ).length
              }
            </p>
          </div>
        </div>

        <Panel title="Stage distribution">
          <div className="flex flex-wrap gap-3">
            {stageCounts.map((s) => (
              <button
                key={s.stage}
                type="button"
                onClick={() => setStage(stage === s.stage ? "all" : s.stage)}
                className="rounded-md border border-border px-4 py-3 text-left transition hover:border-primary/60"
              >
                <StageBadge stage={s.stage} />
                <p className="mt-2 font-display text-2xl font-bold">
                  {s.count}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title="Jobs"
          actions={
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Job or part number"
                className="h-9 w-56"
              />
              <Select
                value={stage}
                onValueChange={(v) => setStage(v as ProductionStage | "all")}
              >
                <SelectTrigger className="h-9 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {PRODUCTION_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {isLoading ? (
            <EmptyState message="Loading jobs…" />
          ) : filtered.length === 0 ? (
            <EmptyState message="No jobs match the current filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 eyebrow">Job</th>
                    <th className="py-2 pr-4 eyebrow">Part</th>
                    <th className="py-2 pr-4 eyebrow">Machine</th>
                    <th className="py-2 pr-4 eyebrow">Qty</th>
                    <th className="py-2 pr-4 eyebrow">Stage</th>
                    <th className="py-2 pr-4 eyebrow">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-border/60 hover:bg-muted/30"
                    >
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        <Link
                          to="/production/jobs/$jobId"
                          params={{ jobId: job.id }}
                          className="text-primary hover:underline"
                        >
                          {job.job_number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4">
                        {job.part_number ?? "—"}
                        {job.part_revision ? ` rev ${job.part_revision}` : ""}
                        <span className="block text-xs text-muted-foreground">
                          {job.part_name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {[job.machine_make, job.machine_model]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="py-2.5 pr-4">{job.quantity ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        <StageBadge stage={JOB_STATUS_META[job.status].stage} />
                      </td>
                      <td className="py-2.5 pr-4">
                        <JobStatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
