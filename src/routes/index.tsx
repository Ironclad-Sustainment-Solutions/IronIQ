import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Hexagon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/auth.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "IronIQ — Manufacturing Readiness Intelligence" },
      {
        name: "description",
        content:
          "IronIQ by Ironclad Sustainment Solutions assesses, scores and improves a manufacturing facility's readiness to produce repeatable, compliant, high-quality product at scale.",
      },
      { property: "og:title", content: "IronIQ — Manufacturing Readiness Intelligence" },
      {
        property: "og:description",
        content:
          "IronIQ by Ironclad Sustainment Solutions assesses, scores and improves a manufacturing facility's readiness to produce repeatable, compliant, high-quality product at scale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void getCurrentUser().then((user) => {
      navigate({ to: user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Hexagon className="size-10 animate-pulse fill-primary/20 text-primary" aria-hidden />
        <h1 className="font-display text-2xl font-bold uppercase tracking-[0.2em]">
          Iron<span className="text-primary">IQ</span>
        </h1>
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  );
}
