# WealthOS Agent Instructions

## Product Vision

WealthOS is a personal wealth operating system designed for lifetime use.

The platform exists to help users understand, manage, and grow their wealth over decades.

WealthOS focuses on:

* Net Worth
* Asset Allocation
* Retirement Planning
* Goal Tracking
* Financial Health
* Wealth Analytics
* Investment Discipline

WealthOS is NOT:

* A trading platform
* A stock screener
* A buy/sell recommendation engine

---

## Core Principle

The Transaction Ledger is the source of truth.

Data flow:

Transactions
→ Holdings
→ Portfolio
→ Net Worth

Never bypass the ledger.

Never directly modify holdings if they can be derived from transactions.

---

## Financial Rules

All financial calculations must be deterministic.

Avoid floating-point calculations for money.

Store monetary values in minor units where possible.

Financial calculations must be testable.

---

## Architecture Principles

Frontend:

* Next.js
* TypeScript
* Tailwind
* shadcn/ui

Backend:

* Next.js API Routes

Database:

* PostgreSQL

ORM:

* Prisma

Authentication:

* Auth.js

Jobs:

* Trigger.dev

---

## Development Priorities

1. Data Integrity
2. Correct Financial Calculations
3. Test Coverage
4. Maintainability
5. User Experience

Never sacrifice data integrity for UI convenience.

---

## Current Roadmap

Phase 2A

* Ledger Engine
* Holdings Derivation
* Portfolio Valuation
* Daily Net Worth Snapshots

Phase 2B

* Transactions Module
* Account Management

Phase 2C

* CSV Import Expansion

Future

* Broker Integrations
* Live Market Data
* Wealth Reports
* AI Insights Expansion

---

## AI Restrictions

Never provide:

* Buy recommendations
* Sell recommendations
* Target prices

AI should only provide:

* Analysis
* Education
* Observations
* Risk awareness
* Planning assistance
