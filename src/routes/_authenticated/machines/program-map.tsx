import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/ironiq/layout-primitives";
import { ProgramPartMapEditor } from "@/components/ironiq/program-part-map";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";

export const Route = createFileRoute("/_authenticated/machines/program-map")({
  head: () => ({
    meta: [
      { title: "Program map — IronIQ" },
      {
        name: "description",
        content:
          "Map CNC program numbers to parts for this plant. Unmapped programs still show; part hours wait until the map is filled.",
      },
    ],
  }),
  component: ProgramMapPage,
});

function ProgramMapPage() {
  const { organization, facility } = useApp();

  if (!organization || !facility) {
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <PageHeader eyebrow="Machines" title="Program → part" />
        <EmptyState message="Select an organization and facility first." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow={facility.name}
        title="Program → part"
        description="The control sends O1234, not a part number. Map it here. A second window is only needed if one program is later used on a different part."
        actions={
          <Button asChild variant="outline">
            <Link to="/machines">All machines</Link>
          </Button>
        }
      />
      <ProgramPartMapEditor
        organizationId={organization.id}
        plantId={facility.id}
      />
    </div>
  );
}
