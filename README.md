# WealthOS

WealthOS is a production-oriented personal wealth operating system built with Next.js 15, TypeScript, Prisma, PostgreSQL, Auth.js, Trigger.dev-ready background jobs, Recharts, Tailwind CSS, and shadcn-style UI primitives.

## Architecture Priorities

- Durable relational domain model with foreign keys, audit fields, and extension-friendly source metadata.
- Deterministic financial engines for net worth, retirement planning, goal forecasting, and wealth scoring.
- Import architecture that starts with manual CSV workflows and can add broker APIs without redesign.
- AI provider abstraction that keeps business logic independent of OpenAI, Gemini, Claude, or future providers.
- Storage abstraction prepared for Cloudflare R2-compatible object storage.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure `DATABASE_URL` plus `AUTH_SECRET`.

3. Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
```

Critical calculations are intentionally isolated from the UI and covered by unit tests.

