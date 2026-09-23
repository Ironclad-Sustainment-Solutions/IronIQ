import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/ironiq/legal-page-layout";

export const Route = createFileRoute("/cookies")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cookie Policy — IronIQ" },
      {
        name: "description",
        content: "What cookies IronIQ uses, and why.",
      },
    ],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalPageLayout title="Cookie Policy" lastUpdated="September 2026">
      <p>
        This Cookie Policy explains how Ironclad Sustainment Solutions, LLC
        ("Ironclad," "we," "us," or "our") uses cookies on IronIQ (the
        "Service"). We keep this deliberately short, because IronIQ deliberately
        uses very few cookies, and none of them are for advertising or tracking
        you across other websites.
      </p>

      <h2>1. What We Use Cookies For</h2>
      <p>
        We use cookies for two purposes only: keeping you signed in, and
        remembering one simple display preference. That's it — we do not use
        cookies for advertising, and we do not use third-party analytics or
        tracking cookies.
      </p>

      <h2>2. The Cookies We Set</h2>
      <ul>
        <li>
          <strong>Session cookie.</strong> Set when you sign in, this cookie
          identifies your logged-in session so you don't have to re-enter your
          credentials on every page. It is set to expire automatically after 14
          days, is not readable by JavaScript running on the page (an "HttpOnly"
          cookie), and is strictly necessary for the Service to function — there
          is no way to use a logged-in account without it.
        </li>
        <li>
          <strong>Sidebar preference cookie ("sidebar_state").</strong> Set when
          you collapse or expand the navigation sidebar, this cookie simply
          remembers that display preference the next time you visit, for up to 7
          days. It contains no personal information.
        </li>
      </ul>

      <h2>3. Third-Party Cookies</h2>
      <p>
        We do not embed third-party advertising, analytics, or social-media
        tracking scripts in the Service, and we are not aware of any third-party
        cookies being set through your ordinary use of it. If this changes in
        the future, we will update this Policy.
      </p>

      <h2>4. Managing Cookies</h2>
      <p>
        Because the session cookie is strictly necessary to keep you signed in,
        blocking or deleting it will simply sign you out — there is no separate
        cookie-consent mechanism to configure within the Service. Most browsers
        let you view, delete, or block cookies through their settings; consult
        your browser's help documentation for how to do so.
      </p>

      <h2>5. Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy if what we use cookies for changes. If
        we make material changes, we will update the "Last updated" date above.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        Questions about this Cookie Policy can be directed to Ironclad
        Sustainment Solutions, LLC at{" "}
        <a href="mailto:HR@ironcladsustainment.com">
          HR@ironcladsustainment.com
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
