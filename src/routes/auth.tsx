import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { signup, login, getCurrentUser } from "@/lib/auth/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — IronIQ Manufacturing Intelligence" },
      {
        name: "description",
        content:
          "Secure sign-in for IronIQ, the manufacturing readiness and operational improvement platform by Ironclad Sustainment Solutions.",
      },
      { property: "og:title", content: "Sign in — IronIQ" },
      {
        property: "og:description",
        content:
          "Secure access to manufacturing readiness assessments, findings, and improvement programs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCurrentUser().then((user) => {
      if (user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup({ data: { email, password, fullName } });
        toast.success(
          "Account created — an admin will review and approve access before you can sign in.",
        );
        setMode("signin");
        setPassword("");
      } else {
        await login({ data: { email, password } });
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between border-r border-border bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Hexagon
            className="size-8 fill-primary/20 text-primary"
            aria-hidden
          />
          <div>
            <p className="font-display text-2xl font-bold uppercase leading-none tracking-[0.2em]">
              Iron<span className="text-primary">IQ</span>
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Ironclad Sustainment Solutions
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <p className="eyebrow">Manufacturing Readiness Module</p>
          <h1 className="mt-3 text-4xl font-semibold uppercase leading-tight tracking-wide">
            Prove a plant can build it right — repeatably, compliantly, at rate.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Seven weighted readiness categories. Evidence-graded confidence
            scoring. Critical-control gating that will not let a plant be called
            production ready when a fundamental control has failed.
          </p>
          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-8">
            {[
              ["7", "Weighted categories"],
              ["0–5", "Maturity scale"],
              ["100%", "Evidence graded"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="metric text-3xl font-semibold text-primary">
                  {v}
                </dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {l}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-muted-foreground">
          Authorized use only. All access and score changes are recorded in the
          audit log.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Hexagon
              className="size-7 fill-primary/20 text-primary"
              aria-hidden
            />
            <p className="font-display text-xl font-bold uppercase tracking-[0.2em]">
              Iron<span className="text-primary">IQ</span>
            </p>
          </div>

          <h2 className="text-2xl font-semibold uppercase tracking-wide">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Access your organization's readiness workspace."
              : "Request access — an admin will review and approve your account before you can sign in."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jordan Vale"
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled
            title="Google sign-in isn't wired up yet — see MIGRATION_PHASE2.md"
          >
            Continue with Google (coming soon)
          </Button>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have access?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
