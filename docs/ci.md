# CI Setup

This repository uses GitHub Actions to validate the backend, frontend unit checks, and Playwright end-to-end coverage.

## Workflow

- Workflow file: `.github/workflows/ci.yml`
- Triggers:
  - every pull request that changes `repofy-frontend/**`, `repofy-backend/**`, or `.github/workflows/**`
  - pushes to `main` and `staging` for the same paths
  - manual `workflow_dispatch`

## Required Status Checks

Configure branch protection to require these checks:

- `backend`
- `frontend-unit`
- `frontend-e2e`

## Required Repository Secrets

Add these secrets before relying on the Playwright job:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

## What Each Job Runs

- `backend`
  - `npm ci`
  - `npm run typecheck`
  - `npm test -- --coverage`
  - `npm run build`

- `frontend-unit`
  - `npm ci`
  - `npm run lint`
  - `npm test -- --coverage`
  - `npm run build`

- `frontend-e2e`
  - installs backend and frontend dependencies
  - installs Playwright browsers
  - runs `npm run test:e2e`
  - uploads Playwright artifacts on failure

The Playwright job runs the backend in `MOCK_AI=true` mode and still requires Supabase-backed test credentials for the authenticated setup flow.

## Local Parity

Useful local commands:

```bash
cd repofy-backend && npm run typecheck
cd repofy-backend && npm test -- --coverage
cd repofy-backend && npm run build

cd repofy-frontend && npm run lint
cd repofy-frontend && npm test -- --coverage
cd repofy-frontend && npm run build
cd repofy-frontend && npm run test:e2e
```
