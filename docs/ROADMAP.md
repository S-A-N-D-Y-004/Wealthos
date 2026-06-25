# WealthOS Roadmap

## Current Version

**Version 0.9.0**

### Completed Milestones

* ✅ Foundation & Project Architecture
* ✅ Ledger Engine
* ✅ Holdings Derivation
* ✅ Portfolio Valuation
* ✅ Daily Net Worth Snapshots
* ✅ Ledger Test Suite
* ✅ CSV → Ledger Integration
* ✅ Real Ledger Dashboard
* ✅ Live Market Pricing
* ✅ Alerts & Notifications Engine
* ✅ AI Financial Coach
* ✅ News & Sentiment Intelligence
* ✅ Portfolio Return Calculations
* ✅ XIRR & Money-Weighted Return
* ✅ Portfolio Risk Analytics

---

# Phase 1 — Foundation ✅

### Project Foundation

Completed

* Next.js 15 App Router
* TypeScript
* Tailwind CSS
* shadcn/ui
* Prisma ORM
* Auth.js foundation
* Trigger.dev job scaffolding
* Modular architecture
* Documentation
* GitHub workflow

---

# Phase 2 — Financial Core ✅

## Ledger Engine

Completed

* Transaction Ledger
* Holdings Derivation
* Portfolio Valuation
* Daily Net Worth Snapshots

### Features

* Immutable transactions
* Derived holdings
* Average cost calculations
* Realized gains
* Unrealized gains
* Portfolio allocation
* Historical snapshots

---

## Import Engine

Completed

Supported Sources

* Angel One
* CoinDCX
* Zerodha Kite
* Paytm Money
* PhonePe Gold
* ICICI Prudential

Features

* CSV validation
* Duplicate detection
* Idempotent imports
* Audit trail
* Ledger persistence

---

## Dashboard

Completed

* Real ledger-backed dashboard
* Net worth
* Portfolio allocation
* Holdings
* Goals
* Retirement
* Notifications

---

## Live Pricing

Completed

Supported Providers

* Yahoo Finance
* CoinGecko
* AMFI
* Manual Gold Provider

Features

* Price snapshots
* Scheduled refresh
* Cached prices
* Stale-price fallback

---

## Alerts & Notifications

Completed

Features

* Portfolio alerts
* Allocation alerts
* Goal alerts
* System alerts
* Notification aggregation
* Read/Unread tracking

---

## AI Financial Coach

Completed

Capabilities

* Portfolio-aware AI
* Wealth score explanations
* Goal analysis
* Retirement insights
* Alert explanations
* Deterministic prompts
* Advisory-only responses

---

## News & Sentiment Intelligence

Completed

Features

* Symbol-based news
* Portfolio-linked news
* Sentiment scoring
* AI explanations
* News-driven alerts

---

# Phase 3 — Production Hardening (Current Focus)

## Authentication & Security

Planned

* Production Auth.js
* Google Sign-In
* Email Authentication
* Protected Routes
* Session Management
* Secure Secrets
* Role-Based Access

---

## Platform Quality

Planned

* Repository cleanup
* Architecture review
* Error handling improvements
* Logging
* Performance optimization
* Test coverage expansion
* CI/CD pipeline

---

# Phase 4 — Portfolio Analytics

In Progress

## Portfolio Return Calculations

Completed

Features

* Absolute return
* Absolute return percentage
* CAGR
* Annualized return
* Portfolio return summaries
* Time range support
* XIRR
* Money-weighted return

---

## Advanced Analytics

In Progress

Features

* Time-Weighted Return
* Sharpe Ratio
* Asset Correlation

Completed

* Portfolio volatility
* Maximum drawdown
* Diversification score
* Concentration risk
* Unified risk rating

---

# Phase 5 — Financial Planning

Planned

* FIRE Calculator
* Coast FIRE
* Barista FIRE
* Retirement Simulator
* Monte Carlo Simulation
* Education Planning
* Home Purchase Planning

---

# Phase 6 — Broker Connectivity

Planned

Direct Integrations

* Angel One API
* Zerodha Kite Connect
* CoinDCX API
* ICICI Prudential
* Additional Broker APIs

CSV imports will remain supported as a fallback.

---

# Phase 7 — Mobile Experience

Planned

* Progressive Web App (PWA)
* Offline Mode
* Push Notifications
* Background Sync
* Mobile-first Experience

---

# Phase 8 — WealthOS Intelligence

Future Vision

* AI Portfolio Reviews
* Monthly Wealth Reports
* Tax Analytics
* Family Wealth Dashboard
* Estate Planning
* Goal Optimization
* Personalized Financial Insights

---

# Engineering Principles

WealthOS follows these core principles:

* Transactions are immutable.
* Holdings are always derived from transactions.
* The ledger is the single source of truth.
* AI is advisory only.
* No automatic investment decisions.
* Every calculation must be deterministic and testable.
* Every major feature must pass:

  * Type checking
  * Unit tests
  * Production build
  * Prisma validation
