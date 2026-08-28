import { createFileRoute } from "@tanstack/react-router";
import { NotYetBuiltPage } from "@/components/ironiq/not-yet-built-page";

export const Route = createFileRoute("/_authenticated/suppliers")({
  component: () => <NotYetBuiltPage title="Suppliers" />,
});
