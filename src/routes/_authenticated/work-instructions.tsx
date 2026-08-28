import { createFileRoute } from "@tanstack/react-router";
import { NotYetBuiltPage } from "@/components/ironiq/not-yet-built-page";

export const Route = createFileRoute("/_authenticated/work-instructions")({
  component: () => <NotYetBuiltPage title="Work Instructions" />,
});
