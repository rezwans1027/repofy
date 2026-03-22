import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

const LAST_UPDATED = "March 22, 2026";

export default function TermsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-mono text-3xl font-bold text-foreground">
          Terms of Service
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Acceptance of Terms
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          By accessing or using Repofy (&quot;the Service&quot;), you agree to
          be bound by these Terms of Service. If you do not agree with any part
          of these terms, you may not use the Service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Description of Service
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Repofy is an AI-powered platform for analyzing public GitHub profiles.
          We provide developer evaluations, profile metrics, and AI-generated
          career advisor reports. The Service is available at repofy.dev and
          through our associated applications.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Account Requirements
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          To use certain features of the Service, you must sign in using GitHub
          OAuth. By authenticating, you authorize us to access your public GitHub
          profile information. You are responsible for maintaining the security
          of your account and for all activities that occur under it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Credits &amp; Payments
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Repofy uses a credit-based system to access premium features:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>
            Credits are purchased in packs (e.g., $5 for 2 growth credits) and
            are non-transferable.
          </li>
          <li>
            One growth credit is consumed per AI advisor session.
          </li>
          <li>
            All payments are processed securely through Stripe. We do not store
            your payment card details.
          </li>
          <li>
            Credits are non-refundable once purchased unless required by
            applicable law. If a technical error prevents credit delivery, please
            contact us for resolution.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Acceptable Use
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          You agree not to misuse the Service. This includes, but is not limited
          to:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
          <li>Attempting to circumvent the credit system or rate limits.</li>
          <li>
            Using automated tools to scrape or bulk-access the Service without
            prior written permission.
          </li>
          <li>
            Interfering with or disrupting the integrity of the Service or its
            infrastructure.
          </li>
          <li>
            Using the Service for any unlawful purpose or in violation of any
            applicable law.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Intellectual Property
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          All content, branding, and code that comprise the Repofy Service are
          owned by Repofy or its licensors. You retain ownership of any data you
          provide. By using the Service, you grant us a limited license to
          process your data solely for the purpose of delivering the Service.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Disclaimers
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          The AI-generated advisor reports and developer evaluations provided by
          Repofy are{" "}
          <strong className="text-foreground">
            informational only and do not constitute professional advice
          </strong>
          . They should not be used as the sole basis for hiring decisions,
          career changes, or any other consequential actions. The Service is
          provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, express or implied.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Limitation of Liability
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          To the fullest extent permitted by law, Repofy and its affiliates
          shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages arising out of or related to your
          use of the Service. Our total liability for any claim shall not exceed
          the amount you paid to us in the twelve (12) months preceding the
          claim.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Termination
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We reserve the right to suspend or terminate your access to the
          Service at any time, with or without cause, and with or without
          notice. Upon termination, your right to use the Service ceases
          immediately. Any unused credits will not be refunded upon termination
          for cause.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Governing Law
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          These Terms shall be governed by and construed in accordance with the
          laws of the jurisdiction in which Repofy operates, without regard to
          conflict of law principles. Any disputes arising from these Terms or
          the Service shall be resolved in the courts of that jurisdiction.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Changes &amp; Contact
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may revise these Terms at any time. Material changes will be
          communicated by updating the &quot;Last updated&quot; date above. Your
          continued use of the Service constitutes acceptance of the revised
          Terms.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          For questions about these Terms, contact us at{" "}
          <a
            href="mailto:rezwanswe23@gmail.com"
            className="text-cyan underline underline-offset-4 hover:text-cyan/80"
          >
            rezwanswe23@gmail.com
          </a>
          .
        </p>
      </section>
    </article>
  );
}
