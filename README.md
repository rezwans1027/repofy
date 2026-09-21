<div align="center">

# Repofy

**Know any developer. From their code.**

AI-powered GitHub intelligence platform — analyze any GitHub profile in depth, get personalized career advice, and export polished PDFs.

[Live App](https://repofy.dev) &nbsp;&middot;&nbsp; [Report Bug](https://github.com/rezwans1027/repofy/issues) &nbsp;&middot;&nbsp; [Request Feature](https://github.com/rezwans1027/repofy/issues)

</div>

---

## What is Repofy?

Repofy turns GitHub profiles into actionable intelligence. Instead of relying on resumes, Repofy evaluates developers based on what actually matters — their code.

### Live Features

- **GitHub Profile Explorer** — Search any GitHub user and explore their real stats, top repos, language breakdown, activity feed, and contribution heatmap
- **AI Profile Advisor** — Generate actionable career advice: project ideas with tech stacks, skills to learn, repo improvements, profile optimizations, and a personalized 12-week growth roadmap
- **PDF Export** — Export any advice plan as a polished multi-page PDF

### Coming Soon

- **AI Developer Analysis** — Hiring-grade reports with overall scores, hire recommendations, 6-axis radar charts, per-repo code grades, strengths, red flags, and tailored interview questions
- **Candidate Comparison** — Side-by-side comparison with overlaid radar charts, stats breakdowns, and language profiles
- **Evals Dashboard** — Browse, search, filter, and sort all saved evaluations in one place

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Framer Motion](https://motion.dev/) |
| **Backend** | [Express.js 4](https://expressjs.com/), TypeScript, Node.js |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + Auth + RLS) |
| **AI** | OpenAI API for analysis & advice generation |
| **Payments** | [Stripe](https://stripe.com/) |
| **Email** | [Resend](https://resend.com/) |
| **Caching** | [Redis](https://redis.io/) (via ioredis) |
| **Monitoring** | [Sentry](https://sentry.io/) |
| **Testing** | [Vitest](https://vitest.dev/), [Playwright](https://playwright.dev/), Testing Library |
| **CI/CD** | GitHub Actions |
| **Deployment** | Vercel (frontend), Railway (backend) |

---

## Project Structure

```
repofy/
├── repofy-frontend/            # Next.js application
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   │   ├── (app)/          # Protected routes (dashboard, advisor, profile, etc.)
│   │   │   ├── (auth)/         # Auth routes (login, callback)
│   │   │   └── (legal)/        # Privacy policy, terms of service
│   │   ├── components/         # React components
│   │   ├── hooks/              # Custom hooks
│   │   ├── lib/                # Utilities & helpers
│   │   └── shared/             # Shared types & constants
│   ├── e2e/                    # Playwright E2E tests
│   └── __tests__/              # Unit tests
│
├── repofy-backend/             # Express API server
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── routes/             # Route definitions
│   │   ├── services/           # Business logic
│   │   ├── middleware/         # Auth, rate limiting, CSRF
│   │   ├── config/             # Environment & configuration
│   │   └── lib/                # Utilities
│   └── tests/                  # Unit tests
│
├── supabase/migrations/        # Database migrations
├── .github/workflows/          # CI pipeline
└── docs/                       # Documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** 22+
- **npm** 10+
- A [Supabase](https://supabase.com/) project
- A [Stripe](https://stripe.com/) account
- A [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### 1. Clone the repository

```bash
git clone https://github.com/rezwans1027/repofy.git
cd repofy
```

### 2. Set up environment variables

**Frontend** — create `repofy-frontend/.env.local`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3100
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
API_BACKEND_URL=http://localhost:3101/api
```

**Backend** — create `repofy-backend/.env`:

```env
PORT=3101
CORS_ORIGIN=http://localhost:3100
FRONTEND_URL=http://localhost:3100
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
RESEND_API_KEY=your_resend_api_key
TOKEN_ENCRYPTION_KEY=your_64_char_hex_key
NODE_ENV=development
```

### 3. Install dependencies & run

Build the shared contracts first, from the repository root:

```bash
npm --prefix packages/contracts ci
npm --prefix packages/contracts run build
```

```bash
# Terminal 1 — Backend
cd repofy-backend
npm ci
npm run dev          # → http://localhost:3101

# Terminal 2 — Frontend
cd repofy-frontend
npm ci
npm run dev          # → http://localhost:3100
```

After changing contracts, rebuild them and rerun `npm ci` in each app to refresh its installed copy. See [the evidence foundation ADR](docs/adr/0001-evidence-foundation.md) for package exports, feature flags, and deployment build contexts. Feature 1 is disabled by default.

Run 04 adds verified GitHub App identity linking, installation association and user-scoped repository discovery. See [GitHub App setup and live verification](docs/github-app-setup.md); installation credentials are separate from the existing login configuration. Run 05 adds the authenticated `/readiness/new` saved-selection picker, authorization attestation and signed security webhooks; see the [Run 05 handoff](feature%20one%20implementation/05-handoff.md). Run 06 adds commit-pinned static ingestion, security filtering and crash-cleanup integration; see the [Run 06 handoff](feature%20one%20implementation/06-handoff.md). Live development-app verification still requires installation credentials. Run 07 adds durable jobs, fenced retries, atomic analysis settlement and progress/history UI; see the [Run 07 handoff](feature%20one%20implementation/07-handoff.md) and [worker operations](docs/analysis-worker-operations.md). Run 08 adds static inventory/evidence extraction and authorized SHA-bound metadata; see the [Run 08 handoff](feature%20one%20implementation/08-handoff.md). Run 09 adds 16 bounded TS/JS implementation detectors with versioned coverage and evidence safeguards; see the [Run 09 handoff](feature%20one%20implementation/09-handoff.md). The required human sample review is complete with 4/4 agreement; broader precision calibration remains pending. Run 10 adds baseline Python/Java parsing and explicit coverage/unknown states in storage and the UI; see the [Run 10 handoff](feature%20one%20implementation/10-handoff.md). Run 11 adds deterministic capability aggregation and confidence, all-five-role coverage, frozen calculation traces and owner evidence queries; see the [Run 11 handoff](feature%20one%20implementation/11-handoff.md). Its human calculation review is complete with 4/4 agreement. Run 12 adds bounded model selection, validated narratives and ranked improvements; its human review is complete, while live pinned-model access remains blocked. Run 13 adds the private saved-report and evidence UI, all five role views, permission-checked locations and owner deletion, verified locally through the real API/worker/PostgreSQL browser flow; see the [Run 13 handoff](feature%20one%20implementation/13-handoff.md). Run 14 adds persisted target-role focus, immutable rescans with authorized snapshot reuse, rescan history and owner-only evidence comparisons; see the [Run 14 handoff](feature%20one%20implementation/14-handoff.md). Run 15 adds private finding feedback, controlled review and versioned provenance context with unknown contribution confidence and no automatic score penalty; human review agreed with all five examples and local verification passed. See the [Run 15 handoff](feature%20one%20implementation/15-handoff.md). Run 16 implements frozen benchmarks, integrated load/recovery/browser checks, a blocking Feature 1 CI gate and a recorded first human review (24 claim/unknown cases and 30 role boundaries). Its rollout decision is **HOLD**: independent engineering calibration, live providers, deployed operations/privacy/capacity, manual accessibility and hosted/CI verification remain pending. See the [Run 16 handoff](feature%20one%20implementation/16-handoff.md) and [release evidence](docs/benchmarks/run16-release-evidence.md). All intake flags remain off.

---

## Scripts

### Frontend (`repofy-frontend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3100 |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests |

### Backend (`repofy-backend/`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Unit tests with coverage report |

---

## Architecture

### Authentication Flow

1. User clicks **Get Started** → redirected to GitHub OAuth via Supabase (PKCE)
2. GitHub redirects back with auth code → exchanged for session
3. GitHub access token encrypted (AES-256-GCM) and stored server-side
4. HTTP-only secure cookies maintain session state
5. Middleware protects all `/dashboard/*` routes

### Security

- Content-Security-Policy with nonce-based script-src
- HSTS, X-Frame-Options, X-Content-Type-Options headers
- Helmet security middleware on the backend
- CSRF protection & rate limiting (global, per-route)
- Row-Level Security (RLS) on all Supabase tables
- GitHub token encryption at rest

### Credits System

- Free tier for profile exploration (no credit card required)
- Growth credits for AI advisor sessions — $5 for 2 credits, 1 credit per session
- Stripe-powered checkout with webhook integration

---

## CI/CD

GitHub Actions pipeline runs on every push to `main`/`staging` and on PRs:

1. **Path filter** — only runs jobs for changed packages
2. **Backend** — type-check → unit tests with coverage → build
3. **Frontend** — lint → unit tests with coverage → build
4. **E2E** — Playwright tests (runs after backend & frontend pass)

Concurrency groups auto-cancel superseded runs.

---

## Design

Dark-first terminal aesthetic with a cyan (`#22D3EE`) accent. Inter for body text, JetBrains Mono for headings and code. Custom SVG radar charts, CSS grid heatmaps, and Framer Motion scroll-triggered animations throughout.

---

## License

This project is proprietary. All rights reserved.

Database changes use the ordered, checksum-verified migration runner documented in [database operations](docs/database.md). New migrations live in `supabase/migrations`; both historical directories are preserved. Apply Feature 1 migrations before deploying its account export support, with feature intake disabled.
