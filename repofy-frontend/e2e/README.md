# E2E Test Setup

## Prerequisites

- Node.js 18+
- Playwright browsers installed: `npx playwright install`
- Backend and frontend dependencies installed

## Required Environment Variables

### Authenticated tests

Set these for the `setup` project (login flow) and all authenticated specs:

| Variable | Description |
|---|---|
| `E2E_TEST_EMAIL` | Email for a dedicated Supabase test account |
| `E2E_TEST_PASSWORD` | Password for the test account |

### Supabase (seed helpers)

Needed by `e2e/helpers/seed.ts` for direct PostgREST calls:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL (also read from `.env.local`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (also read from `.env.local`) |

### Backend (started automatically by Playwright)

The backend is launched with `MOCK_AI=true` via `playwright.config.ts`.
When `MOCK_AI=true`, `GITHUB_TOKEN` and `OPENAI_API_KEY` are **not required** — all GitHub API and AI calls return deterministic mock data.

For production-like runs without mock mode, also set:

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub personal access token |
| `OPENAI_API_KEY` | OpenAI API key |

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
