This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

This application consumes `@repofy/contracts` from `../packages/contracts`. From the repository root, run `npm --prefix packages/contracts ci` and `npm --prefix packages/contracts run build` before running `npm ci` here. Rebuild and reinstall after contract edits. Deployments must include the sibling package during installation; see [the deployment instructions](../docs/adr/0001-evidence-foundation.md#build-and-deployment).

The private readiness flow uses `/readiness` for saved history, `/readiness/new`
for authorized selection, `/readiness/jobs/:id` for resumable progress and
`/readiness/reports/:id` for completed reports. Saved owner reads and deletion
remain available when intake is disabled. Source locations require a fresh
permission check; reports never expose raw source. See the
[Run 13 decision and API map](../docs/adr/0013-private-readiness-ui.md) and
[local browser test setup](e2e/README.md#private-readiness-checks-without-hosted-credentials).

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3100](http://localhost:3100) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Role focus and rescan comparisons

Saved readiness reports include a separately persisted target-role preference,
authorized rescan controls and immutable history. The private comparison route is
`/readiness/reports/:baselineId/compare/:targetId`; evidence links open the correct
report's explorer. Role focus does not generate content or change scores.
Rescans/comparisons remain gated by backend capabilities and owner admission.
See the [Run 14 handoff](../feature%20one%20implementation/14-handoff.md) and
[local browser setup](e2e/README.md). Build contracts before installing the apps.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
