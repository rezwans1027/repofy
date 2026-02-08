import Link from "next/link";
import { TerminalWindow } from "@/components/ui/terminal-window";
import { Lock, Mail } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="text-cyan font-mono text-lg font-bold tracking-tight hover:opacity-80 transition-opacity inline-block"
      >
        repofy
      </Link>

      <TerminalWindow title="auth — signup">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              <span className="text-cyan">$</span> repofy auth signup
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 px-4 py-3">
              <p className="font-mono text-sm text-yellow-400">
                <span className="font-bold">notice:</span> Sign up is currently
                closed.
              </p>
              <p className="font-mono text-sm text-muted-foreground mt-2">
                Repofy is in private beta. To request access, email{" "}
                <a
                  href="mailto:rezwans1027@gmail.com"
                  className="text-cyan hover:underline underline-offset-4"
                >
                  rezwans1027@gmail.com
                </a>
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground/50">
              <Lock className="size-3" />
              <span>Registration disabled</span>
            </div>
          </div>

          <p className="text-center font-mono text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-cyan hover:underline underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </TerminalWindow>
    </div>
  );
}
