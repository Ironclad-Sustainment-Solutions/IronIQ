import { Link } from "@tanstack/react-router";
import { IronIQMark } from "@/components/ironiq/ironiq-mark";

/**
 * Shared shell for the three public legal pages -- deliberately simple
 * and standalone (no sidebar, no auth), since these need to be readable
 * and linkable by anyone, logged in or not, including someone who's
 * never created an account yet. Cross-links to the other two documents
 * live in the footer so a reader lands on one and can reach the rest
 * without hunting for them elsewhere in the app.
 */
export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/" className="flex items-center gap-3">
            <IronIQMark className="size-7" />
            <span className="font-display text-lg font-bold uppercase leading-none tracking-[0.2em]">
              Iron<span className="text-primary">IQ</span>
            </span>
          </Link>
          <a
            href="/auth"
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {lastUpdated}
        </p>
        <div className="mt-8 max-w-none space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_strong]:text-foreground [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
          {children}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link to="/cookies" className="hover:text-foreground">
            Cookie Policy
          </Link>
          <a
            href="mailto:noah.osman@ironcladsustainment.com"
            className="hover:text-foreground"
          >
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
