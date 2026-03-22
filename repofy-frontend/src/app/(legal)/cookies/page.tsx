import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
};

const LAST_UPDATED = "March 22, 2026";

export default function CookiesPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <h1 className="font-mono text-3xl font-bold text-foreground">
          Cookie Policy
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          What Are Cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Cookies are small text files stored on your device by your web browser
          when you visit a website. They are widely used to make websites work
          efficiently and to provide information to site operators.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Cookies We Use
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Repofy uses a minimal set of cookies, limited to what is necessary for
          the Service to function:
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-mono text-base font-medium text-foreground">
              Essential / Authentication Cookies
            </h3>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  sb-*
                </code>{" "}
                — Supabase session cookies used to maintain your authenticated
                session.
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  access_token
                </code>{" "}
                — An HttpOnly cookie containing your short-lived session token.
                It is not accessible to client-side JavaScript.
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  refresh_token
                </code>{" "}
                — An HttpOnly cookie used to renew your session without
                requiring you to sign in again. It has a 30-day lifetime and is
                not accessible to client-side JavaScript.
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  PKCE verifier
                </code>{" "}
                — A temporary value used during the OAuth sign-in flow to
                prevent authorization code interception attacks.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-mono text-base font-medium text-foreground">
              Functional Cookies
            </h3>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                  theme
                </code>{" "}
                — Set by next-themes to remember your preferred color scheme
                (dark or light).
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          No Analytics or Advertising Cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Repofy does <strong className="text-foreground">not</strong> use any
          analytics cookies, tracking pixels, or advertising cookies. We do not
          use Google Analytics, Facebook Pixel, or any similar tracking
          technology. Your browsing behavior is not tracked or profiled for
          advertising purposes.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Third-Party Cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          When you make a credit purchase, you are redirected to Stripe&apos;s
          checkout page. Stripe may set its own cookies during this process to
          manage the payment session. These cookies are session-scoped and are
          governed by{" "}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan underline underline-offset-4 hover:text-cyan/80"
          >
            Stripe&apos;s Privacy Policy
          </a>
          .
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Managing Cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          You can control and delete cookies through your browser settings. Most
          browsers allow you to block or remove cookies, but doing so may
          prevent you from signing in or using certain features of the Service.
          Consult your browser&apos;s help documentation for instructions on
          managing cookies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-mono text-xl font-semibold text-foreground">
          Changes &amp; Contact
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update this Cookie Policy from time to time. Changes will be
          reflected by the &quot;Last updated&quot; date above. For questions,
          contact us at{" "}
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
