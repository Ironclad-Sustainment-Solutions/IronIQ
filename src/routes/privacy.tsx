import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/ironiq/legal-page-layout";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Privacy Policy — IronIQ" },
      {
        name: "description",
        content:
          "How Ironclad Sustainment Solutions, LLC collects, uses, and protects data in IronIQ.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="September 2026">
      <p>
        This Privacy Policy explains how Ironclad Sustainment Solutions, LLC
        ("Ironclad," "we," "us," or "our") collects, uses, discloses, and
        safeguards information in connection with IronIQ, our manufacturing
        readiness and operational improvement platform (the "Service").
      </p>
      <p>
        This Policy applies to the individual account holders who use the
        Service ("you") on behalf of a customer organization ("Customer"). If
        you are an employee, contractor, or representative of a Customer using
        the Service on that Customer's behalf, please also refer to your
        employer's own policies, since your employer may have additional
        obligations or agreements with us that govern that relationship (see our
        Terms of Service).
      </p>

      <h2>1. Information We Collect</h2>
      <h3>1.1 Account information</h3>
      <p>
        When you or your organization creates an account, we collect your email
        address, a securely hashed password (we never store your password in
        plain text), and any profile details you choose to add, such as your
        full name, job title, phone number, and avatar image. If you sign in
        using Google or Microsoft ("OAuth sign-in"), we receive your name and
        email address from that provider, and a token that lets us confirm your
        identity — we do not receive or store your Google or Microsoft password.
      </p>
      <h3>1.2 Organizational and operational data</h3>
      <p>
        The Service is built around helping manufacturing organizations track
        and improve their operations. Depending on how your organization uses
        IronIQ, this may include: machine and equipment records, part and
        program data, assessment responses, findings and improvement records,
        supplier information, and — where your organization chooses to connect
        it — machine telemetry collected by the optional IronIQ Edge agent
        running on your own local network (cycle times, run/idle states, and
        similar equipment-level data). We do not require or expect this
        operational data to include personal information about your employees
        beyond what your organization chooses to enter (for example, naming a
        person as responsible for a finding).
      </p>
      <h3>1.3 Information collected automatically</h3>
      <p>
        We use a single, functional session cookie to keep you signed in (see
        our Cookie Policy for details). We also maintain standard application
        logs and an internal audit trail of account and administrative actions
        (such as sign-ins, role changes, and record updates) for security and
        accountability purposes.
      </p>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>To provide, operate, and maintain the Service;</li>
        <li>
          To authenticate you and maintain the security of your account and your
          organization's data;
        </li>
        <li>
          To power features you or your organization choose to use, including
          AI-assisted features (see Section 3);
        </li>
        <li>
          To communicate with you about your account, security notices, or
          changes to our policies;
        </li>
        <li>
          To provide customer support, including when Ironclad staff assist with
          setup or troubleshooting of connected equipment; and
        </li>
        <li>
          To maintain the audit and security logs described above, and to
          investigate misuse or security incidents.
        </li>
      </ul>
      <p>
        We do not sell your personal information, and we do not use your account
        or organizational data to serve you third-party advertising.
      </p>

      <h2>3. AI-Assisted Features</h2>
      <p>
        Certain features (such as "Ask IronIQ") send relevant text you or your
        organization provides to third-party AI service providers — currently
        Anthropic and OpenAI — to generate responses or to match your query
        against a shared library of anonymized precedent from other engagements.
        We take reasonable steps to avoid sending identifying information from
        other customers when doing so, and we do not permit these providers to
        use data submitted through the Service to train their general-purpose
        models, to the extent such controls are available to us under our
        agreements with them. If you have questions about a specific AI
        feature's data handling, contact us using the details at the bottom of
        this page.
      </p>

      <h2>4. How We Share Information</h2>
      <p>We share information only in the following circumstances:</p>
      <ul>
        <li>
          <strong>Service providers.</strong> We use third-party infrastructure
          and processing providers to operate the Service, including our hosting
          provider, our database provider, our object-storage provider (for
          uploaded files), and the AI providers described above. These providers
          are only permitted to use your information to provide services to us.
        </li>
        <li>
          <strong>Within your organization.</strong> Information you enter is
          generally visible to other authorized users within your own
          organization, according to the roles and permissions your
          organization's administrators configure.
        </li>
        <li>
          <strong>Anonymized precedent.</strong> With appropriate
          de-identification, findings and resolutions from one engagement may
          inform anonymized, non-attributable pattern matching made available to
          other customers through AI-assisted features — this never includes
          your organization's name, identifying details, or raw records.
        </li>
        <li>
          <strong>Legal requirements.</strong> We may disclose information if
          required to do so by law, regulation, legal process, or governmental
          request, or to protect the rights, property, or safety of Ironclad,
          our customers, or others.
        </li>
        <li>
          <strong>Business transfers.</strong> If Ironclad is involved in a
          merger, acquisition, or sale of assets, information may be transferred
          as part of that transaction, subject to this Policy or a policy at
          least as protective of your information.
        </li>
      </ul>
      <p>We do not sell personal information to third parties.</p>

      <h2>5. Data Retention</h2>
      <p>
        We retain account and operational data for as long as your
        organization's account with us is active, or as needed to provide the
        Service. If your organization's relationship with Ironclad ends, we will
        delete or anonymize personal and organizational data within a reasonable
        period thereafter, except where we are required to retain it for legal,
        security, or legitimate business record-keeping purposes (for example,
        audit logs relevant to a security investigation).
      </p>

      <h2>6. Data Security</h2>
      <p>
        We use industry-standard safeguards to protect information, including
        encrypted connections (HTTPS/TLS), securely hashed passwords, database
        access controls that restrict each organization's data to its own
        authorized users, and role-based access controls within the Service. No
        method of transmission or storage is completely secure, and we cannot
        guarantee absolute security.
      </p>

      <h2>7. Your Rights and Choices</h2>
      <p>
        Depending on your location and applicable law, you may have rights to
        access, correct, or request deletion of your personal information, or to
        object to or restrict certain processing. If you are using the Service
        on behalf of an organization, please first contact your organization's
        administrator, since they may control your account and its data. You may
        also contact us directly using the details below, and we will respond
        consistent with applicable law.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is intended for business use by adults and is not directed
        to children. We do not knowingly collect personal information from
        children.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        We are based in the United States, and information we collect is
        processed and stored in the United States. If you access the Service
        from outside the United States, your information will be transferred to,
        stored, and processed in the United States, which may have data
        protection laws different from those of your country.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make material
        changes, we will update the "Last updated" date above and, where
        appropriate, provide additional notice.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Questions about this Privacy Policy can be directed to Ironclad
        Sustainment Solutions, LLC at{" "}
        <a href="mailto:HR@ironcladsustainment.com">
          HR@ironcladsustainment.com
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
