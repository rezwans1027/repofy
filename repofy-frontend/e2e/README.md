# E2E Test Setup

## Prerequisites

- Node.js 22+
- Playwright browsers installed: `npx playwright install`
- Backend and frontend dependencies installed

## Private readiness checks without hosted credentials

Build `packages/contracts` before installing both applications. Install Chromium
with `npx playwright install chromium`, then build the frontend with
`API_BACKEND_URL=http://127.0.0.1:3191/api npm run build`. Run these suites
sequentially because they share loopback ports 3190 and 3191:

```bash
npm run test:e2e:readiness
npm run test:e2e:selection
npm run test:e2e:report
```

The report suite needs PostgreSQL 17 (`PG_BINDIR` or a disposable loopback
`TEST_PG_ADMIN_URL`); the runner creates and removes its own database. It runs real
owner APIs and the complete worker through validated publication. GitHub, model
and identity transports use synthetic fixtures, with no application secrets or
mock report endpoints. Screenshots in `test-results/run13-*.png` and `test-results/run14-*.png` contain only
synthetic data. The report suite includes role preference persistence, unchanged rescans,
expired-token replay, a synthetic branch that moves after admission, qualified comparisons,
evidence links, desktop/mobile axe checks and baseline deletion. See [CI instructions](../../docs/ci.md#run-13-private-report-verification).

The remaining instructions below apply to the separate hosted-account suite.

## Current hosted setup and limitations

`auth.setup.ts` loads a previously saved OAuth session from ignored `e2e/.auth/user.json` and verifies `/dashboard`. It does not consume `E2E_TEST_EMAIL` or `E2E_TEST_PASSWORD`. Generate a fresh session manually against a dedicated development account, keep it out of source control, and use the `E2E_STORAGE_STATE` CI secret for the explicit `hosted_regression=true` workflow dispatch. CI validates presence and writes the session with mode 0600; expired sessions fail. No session or network trace is uploaded.

The backend requires the actual environment in `src/config/env.ts`, including `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, the OAuth `GITHUB_APP_CLIENT_ID`/`GITHUB_APP_CLIENT_SECRET`, token encryption, admin, Stripe/Resend and engine configuration. The CI workflow enumerates its dedicated-test values and required secrets. GitHub OAuth credentials are separate from Feature 1 installation credentials. Seed helpers use the account's access cookie plus the Supabase URL/anon key.

`playwright.config.ts` starts the normal development apps; it does **not** enable `MOCK_AI` or start an engine. The hosted suite still has legacy report-generation expectations against disabled `/api/analyze/:username`. Those expectations and development provider/engine resources must be reconciled before claiming a hosted regression pass. Fake OpenAI/Stripe keys in CI are not provider validation. Do not enable the disabled legacy route or Feature 1 flags just to make a test pass. Run 16 records this as an external hosted-regression gate, with ordinary app unit/HTTP regressions measured separately.

## Recommended: Dedicated Test Account

Create a Supabase user specifically for E2E tests to avoid data-loss risk.
The cleanup helpers scope deletions to specific `analyzed_username` values
seeded during the test, but a dedicated account provides an extra safety layer.

## Running Tests

```bash
# All projects (setup + unauthenticated + authenticated)
npx playwright test

# Unauthenticated tests only (no login creds needed)
npx playwright test --project=unauthenticated

# With headed browser for debugging
npx playwright test --headed
```
# Run 15 report extension

The separate `npm run test:e2e:report` suite also exercises private finding
feedback, controlled review and versioned neutral provenance. Its fourth serial
case uses the preceding synthetic report, refreshes an expired cookie before a
double save, edits/reloads feedback, checks reviewer privileges and proves that
feedback causes no model call or score rewrite. Explicit reanalysis produces
aggregation 1.1.0 with unknown contribution and the same role calculations.
Desktop/mobile feedback and provenance captures are `run15-*.png`; axe and
horizontal overflow checks use the real production UI. Run this suite after the
production build, sequentially with the other port-3190/3191 harnesses.
Provenance captures temporarily hide fixed application navigation so it cannot
overlay the middle of a panel taller than the viewport; interaction and axe
checks run against the unmodified page.

## Run 16 report extension

The fifth serial case exercises a mixed TypeScript/Python selection, keyboard start and progress announcements, saved report/evidence access during simultaneous GitHub/model outages, and an unsupported native-language report with all five roles unknown. It checks desktop/mobile axe and overflow; `run16-mixed-*.png` captures contain only synthetic data. Human screen-reader verification remains a release gate. The separate backend `release:load` runner covers Java, dependency-only, empty, five-repository and count-limit scenarios through the same actual PostgreSQL/API/worker composition.
