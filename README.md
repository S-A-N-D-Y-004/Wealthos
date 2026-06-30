# WealthOS

> **A Personal Wealth Operating System built for long-term financial management.**

WealthOS is a production-oriented personal wealth platform that consolidates investments, tracks net worth, analyzes portfolios, monitors market movements, and provides AI-powered financial insights—all from a single ledger-driven architecture.

Unlike traditional portfolio trackers, WealthOS is built around an immutable financial ledger where every holding is derived from transactions, ensuring deterministic, auditable, and testable calculations.

---

# Current Version

**Version v1.0.0-beta**

## Core Features

### Financial Ledger

* Immutable transaction ledger
* Derived holdings
* Portfolio valuation
* Daily net worth snapshots
* Historical wealth tracking

### Portfolio Management

* Multi-account support
* Asset allocation
* Gain/Loss calculations
* Net worth tracking
* Goal tracking
* Retirement planning

### Import Engine

Supported sources:

* Angel One
* CoinDCX
* Zerodha Kite
* Paytm Money
* PhonePe Gold
* ICICI Prudential

Features:

* CSV imports
* Validation
* Duplicate detection
* Idempotent processing
* Ledger persistence

### Live Market Pricing

Supports:

* Stocks
* ETFs
* Mutual Funds
* Crypto
* Gold

Features:

* Live price snapshots
* Cached prices
* Scheduled refresh
* Graceful stale-price fallback

### Alerts & Notifications

* Portfolio alerts
* Asset allocation alerts
* Goal alerts
* Market alerts
* System notifications
* Read/Unread management

### AI Financial Coach

Portfolio-aware AI capable of:

* Explaining Wealth Score
* Goal analysis
* Retirement readiness
* Portfolio diversification analysis
* Alert explanations
* Personalized financial insights

**AI is advisory only.**

It never:

* Executes trades
* Recommends buying
* Recommends selling
* Modifies financial records

### News & Sentiment Intelligence

* Portfolio-linked news
* Symbol tracking
* Sentiment analysis
* News-driven alerts
* AI-generated explanations

---

# Technology Stack

Frontend

* Next.js 15
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Recharts

Backend

* Prisma ORM
* PostgreSQL
* Auth.js
* Trigger.dev

AI

* Provider abstraction
* OpenAI
* Gemini
* Claude (future-ready)

Infrastructure

* Cloudflare R2-ready storage
* Modular pricing providers
* Background jobs
* Scheduled market refresh

---

# Engineering Principles

WealthOS follows a strict architecture:

* Transactions are immutable.
* Holdings are always derived from transactions.
* The ledger is the single source of truth.
* AI is advisory only.
* Every financial calculation is deterministic.
* Every feature is testable.
* Business logic is independent of UI.

---

# Quality Standards

Every major feature must pass:

```bash
npm run typecheck
npm test
npm run build
npx prisma validate
```

Current project quality:

* 74+ unit tests
* Type-safe architecture
* Modular domain design
* Production-ready build pipeline

---

# Local Development

## 1. Install dependencies

```bash
npm install
```

## 2. Create local environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Generate an Auth.js secret and place it inside `.env.local`:

```bash
npx auth secret
```

At minimum, configure:

* `DATABASE_URL`
* `AUTH_SECRET`

Optional providers can be left blank for local development:

* Google OAuth: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
* Email sign-in: `AUTH_EMAIL_SERVER`, `AUTH_EMAIL_FROM`
* AI providers: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
* News provider: `NEWS_API_KEY`
* Background jobs: `TRIGGER_SECRET_KEY`
* Object storage: `R2_*`

Current pricing providers do not require API keys. Yahoo Finance, CoinGecko, and AMFI use public endpoints; gold/manual prices can come from asset metadata.

---

## 3. Prepare the database

Generate Prisma Client

```bash
npm run db:generate
```

Run Migrations

```bash
npm run db:migrate
```

---

## 4. Start the development server

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

# Verification

Before every commit:

```bash
npm run typecheck
npm test
npm run build
```

---

# Roadmap

Current completed milestones:

* ✅ Foundation
* ✅ Ledger Engine
* ✅ CSV → Ledger Integration
* ✅ Real Dashboard
* ✅ Live Market Pricing
* ✅ Alerts & Notifications
* ✅ AI Financial Coach
* ✅ News & Sentiment Intelligence

See **docs/ROADMAP.md** for upcoming milestones.

---

# Vision

WealthOS is designed to become a long-term personal financial operating system capable of managing investments, tracking wealth, providing AI-assisted financial insights, and supporting future integrations with brokers, banks, and financial services while maintaining transparency, auditability, and user control.
