import { createFileRoute } from "@tanstack/react-router";
import { NotYetBuiltPage } from "@/components/ironiq/not-yet-built-page";

export const Route = createFileRoute("/_authenticated/tooling-fixtures")({
  component: () => <NotYetBuiltPage title="Tooling & Fixtures" />,
});
