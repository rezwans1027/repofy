import type { Metadata } from "next";
import { AnimateOnView } from "@/components/ui/animate-on-view";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "March 22, 2026";

export default function PrivacyPage() {
  return (
    <article className="space-y-10">
      <AnimateOnView delay={0}>
        <header className="space-y-3">
          <h1 className="font-mono text-3xl font-bold text-foreground">
            Privacy Policy
          </h1>
          <p className="font-mono text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </header>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Introduction
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Repofy (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates
            the repofy.dev website and related services. This Privacy Policy
            explains how we collect, use, and protect your information when you use
            our platform.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.08}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Information We Collect
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We collect the following categories of information:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">GitHub profile data</strong> —
              Public repository information, commit history, language statistics,
              and contribution activity fetched via the GitHub API for the profiles
              you analyze.
            </li>
            <li>
              <strong className="text-foreground">OAuth account data</strong> —
              When you sign in with GitHub, we receive your GitHub user ID, email
              address, username, and avatar URL to create and manage your account.
            </li>
            <li>
              <strong className="text-foreground">Payment information</strong> —
              Credit purchases are processed through Stripe. We never store your
              full card number. Stripe provides us with a customer ID, payment
              status, and transaction metadata for credit fulfillment.
            </li>
          </ul>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            How We Use Your Data
          </h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">Profile analysis</strong> —
              Generating developer evaluations and metrics from public GitHub data.
            </li>
            <li>
              <strong className="text-foreground">AI career advice</strong> —
              Producing personalized advisor reports using your analyzed profile
              data and AI models.
            </li>
            <li>
              <strong className="text-foreground">Credit tracking</strong> —
              Managing your credit balance, recording purchases, and tracking usage
              of paid features.
            </li>
          </ul>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Third-Party Services
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We rely on the following third-party providers to operate our service:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">GitHub API</strong> — To fetch
              public profile and repository data for analysis.
            </li>
            <li>
              <strong className="text-foreground">Stripe</strong> — To process
              credit purchases securely.
            </li>
            <li>
              <strong className="text-foreground">Supabase</strong> — For
              authentication, database, and backend infrastructure.
            </li>
            <li>
              <strong className="text-foreground">Hosting provider</strong> — To
              serve the application and store data.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Each third-party service operates under its own privacy policy. We
            encourage you to review their policies independently.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Data Retention &amp; Deletion
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your account data and analysis history for as long as your
            account is active. Cached GitHub profile data is stored temporarily to
            improve performance and is refreshed periodically. You may request
            deletion of your account and all associated data at any time by
            contacting us.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Your Rights
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Depending on your jurisdiction, you may have the right to:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>
              <strong className="text-foreground">Access</strong> — Request a copy
              of the personal data we hold about you.
            </li>
            <li>
              <strong className="text-foreground">Correction</strong> — Ask us to
              correct inaccurate or incomplete data.
            </li>
            <li>
              <strong className="text-foreground">Deletion</strong> — Request that
              we delete your personal data and account.
            </li>
            <li>
              <strong className="text-foreground">Portability</strong> — Receive
              your data in a structured, machine-readable format.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            To exercise any of these rights, please contact us using the
            information below.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Security
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We implement industry-standard security measures to protect your data,
            including encrypted connections (HTTPS/TLS), secure authentication
            tokens, and access controls on our infrastructure. However, no method
            of transmission or storage is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Changes to This Policy
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. When we make
            material changes, we will update the &quot;Last updated&quot; date at
            the top of this page. Your continued use of Repofy after any changes
            constitutes acceptance of the updated policy.
          </p>
        </section>
      </AnimateOnView>

      <AnimateOnView delay={0.06}>
        <section className="space-y-4">
          <h2 className="font-mono text-xl font-semibold text-foreground">
            Contact
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have questions about this Privacy Policy or wish to exercise
            your rights, please reach out to us at{" "}
            <a
              href="mailto:rezwanswe23@gmail.com"
              className="text-cyan underline underline-offset-4 hover:text-cyan/80"
            >
              rezwanswe23@gmail.com
            </a>
            .
          </p>
        </section>
      </AnimateOnView>
    </article>
  );
}
