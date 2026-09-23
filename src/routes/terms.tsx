import { createFileRoute } from "@tanstack/react-router";
import { LegalPageLayout } from "@/components/ironiq/legal-page-layout";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms of Service — IronIQ" },
      {
        name: "description",
        content:
          "Terms governing use of IronIQ, provided by Ironclad Sustainment Solutions, LLC.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="September 2026">
      <p>
        These Terms of Service ("Terms") are a binding agreement between
        Ironclad Sustainment Solutions, LLC ("Ironclad," "we," "us," or "our")
        and the organization or individual accessing or using IronIQ (the
        "Service") (each, a "Customer," "you," or "your"). By accessing or using
        the Service, you agree to be bound by these Terms. If you are entering
        into these Terms on behalf of a company or other legal entity, you
        represent that you have authority to bind that entity, in which case
        "you" refers to that entity.
      </p>
      <p>
        If you and Ironclad have entered into a separate signed agreement (such
        as a master services agreement or order form) that expressly governs
        your use of the Service, the terms of that agreement will control to the
        extent of any conflict with these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        IronIQ is a manufacturing readiness and operational improvement
        platform. Certain features — including live equipment connections made
        through the optional IronIQ Edge agent, and setup of that agent — are
        provided or configured by Ironclad staff as part of your engagement,
        rather than as a fully self-serve feature, and may be subject to
        additional scoping between you and Ironclad.
      </p>

      <h2>2. Accounts and Access</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activity that occurs under your account. You
        agree to notify us promptly of any unauthorized use of your account.
        Access to the Service, and to specific features within it, may be
        restricted by role, as configured by your organization's administrators
        or by Ironclad.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to, and not to permit others to:</p>
      <ul>
        <li>
          Use the Service in violation of any applicable law or regulation;
        </li>
        <li>
          Attempt to gain unauthorized access to the Service, other accounts, or
          systems or networks connected to the Service;
        </li>
        <li>
          Interfere with or disrupt the integrity or performance of the Service;
        </li>
        <li>
          Reverse engineer, decompile, or disassemble any part of the Service,
          except to the extent such restriction is prohibited by applicable law;
        </li>
        <li>
          Use the Service to store or transmit any content that is unlawful,
          infringing, or that you do not have the right to submit; or
        </li>
        <li>
          Use the IronIQ Edge agent, or any other component of the Service, to
          interact with equipment or systems you are not authorized to access.
        </li>
      </ul>

      <h2>4. Your Data</h2>
      <p>
        As between you and Ironclad, you retain all right, title, and interest
        in and to the data, records, and content you or your organization submit
        to the Service ("Customer Data"). You grant Ironclad a limited license
        to host, copy, process, transmit, and display Customer Data solely as
        necessary to provide the Service to you, to provide support, and as
        otherwise described in our Privacy Policy. You are responsible for the
        accuracy, quality, and legality of Customer Data and the means by which
        you acquired it.
      </p>
      <p>
        We may use de-identified, aggregated information derived from Customer
        Data (which does not identify you or your organization) to maintain,
        improve, and develop the Service, including anonymized pattern-matching
        features described in our Privacy Policy.
      </p>

      <h2>5. Intellectual Property</h2>
      <p>
        The Service, including its software, design, workflows, and underlying
        technology, is and remains the property of Ironclad and its licensors.
        Except for the limited right to access and use the Service as permitted
        under these Terms, no rights are granted to you in or to the Service,
        and all rights not expressly granted are reserved by Ironclad.
      </p>

      <h2>6. The IronIQ Edge Agent and Connected Equipment</h2>
      <p>
        The IronIQ Edge agent is provided as a tool for reading data from
        equipment on your own local network and reporting it to the Service. You
        are solely responsible for determining whether it is appropriate to run
        on your network and equipment, for any configuration of your equipment
        or network required to use it, and for compliance with any third-party
        terms (such as your equipment manufacturer's terms) that may apply.
        Support for certain connection protocols may be identified within the
        Service or its documentation as experimental or not yet verified against
        real hardware; you should not rely on such features for critical
        operations without independently verifying their behavior in your own
        environment first.
      </p>

      <h2>7. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES
        OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT
        LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT
        THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
        COMPONENTS, OR THAT ANY DATA, INCLUDING MACHINE TELEMETRY OR
        AI-GENERATED OUTPUT, WILL BE ACCURATE OR COMPLETE. YOU ARE SOLELY
        RESPONSIBLE FOR VERIFYING ANY INFORMATION FROM THE SERVICE BEFORE
        RELYING ON IT FOR OPERATIONAL, SAFETY, OR BUSINESS DECISIONS.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL
        IRONCLAD, ITS OFFICERS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
        PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR
        RELATED TO YOUR USE OF THE SERVICE, EVEN IF IRONCLAD HAS BEEN ADVISED OF
        THE POSSIBILITY OF SUCH DAMAGES. IRONCLAD'S TOTAL AGGREGATE LIABILITY
        ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED
        THE AMOUNT YOU OR YOUR ORGANIZATION PAID TO IRONCLAD FOR THE SERVICE IN
        THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
      </p>
      <p>
        Some jurisdictions do not allow the exclusion or limitation of certain
        damages, so some of the above limitations may not apply to you.
      </p>

      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless Ironclad and its
        officers, employees, and agents from and against any claims,
        liabilities, damages, losses, and expenses (including reasonable
        attorneys' fees) arising out of or in any way connected with: (a) your
        Customer Data; (b) your use or misuse of the Service; (c) your violation
        of these Terms; or (d) your violation of any rights of a third party.
      </p>

      <h2>10. Term and Termination</h2>
      <p>
        These Terms remain in effect for as long as you use the Service. We may
        suspend or terminate your access to the Service if you materially breach
        these Terms and do not cure that breach within a reasonable time after
        notice, or immediately if necessary to protect the security or integrity
        of the Service or other customers. Upon termination, your right to use
        the Service ceases, though provisions of these Terms that by their
        nature should survive (including Sections 4, 5, 7, 8, 9, and 12) will
        survive.
      </p>

      <h2>11. Changes to the Service or These Terms</h2>
      <p>
        We may modify the Service or these Terms from time to time. If we make
        material changes to these Terms, we will update the "Last updated" date
        above and, where appropriate, provide additional notice. Your continued
        use of the Service after changes take effect constitutes acceptance of
        the updated Terms.
      </p>

      <h2>12. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms are governed by the laws of the State of Texas, without
        regard to its conflict-of-laws principles. Any dispute arising out of or
        relating to these Terms or the Service will be brought exclusively in
        the state or federal courts located in Texas, and you consent to the
        personal jurisdiction of those courts.
      </p>

      <h2>13. General Provisions</h2>
      <p>
        If any provision of these Terms is found unenforceable, the remaining
        provisions will remain in full effect. Our failure to enforce any
        provision is not a waiver of that provision. You may not assign these
        Terms without our prior written consent; we may assign these Terms in
        connection with a merger, acquisition, or sale of assets. These Terms,
        together with our Privacy Policy and Cookie Policy, constitute the
        entire agreement between you and Ironclad regarding the Service, unless
        superseded by a separate signed agreement as described above.
      </p>

      <h2>14. Contact Us</h2>
      <p>
        Questions about these Terms can be directed to Ironclad Sustainment
        Solutions, LLC at{" "}
        <a href="mailto:noah.osman@ironcladsustainment.com">
          noah.osman@ironcladsustainment.com
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
