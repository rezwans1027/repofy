import Link from "next/link";
export function IntakeUnavailable() {
  return <section className="space-y-4"><h1 className="text-2xl font-semibold">Project evidence and role readiness</h1><p>New analyses are not available yet.</p><Link href="/readiness" className="underline">View saved reports</Link></section>;
}
