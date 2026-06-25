# WealthOS Architecture

# Overview

WealthOS is a production-oriented personal wealth operating system built around a deterministic financial ledger.

The platform consolidates investments, liabilities, financial goals, market data, and AI-powered insights into a single system while ensuring every financial calculation is transparent, auditable, and reproducible.

The core architectural principle is:

> **The Transaction Ledger is the single source of truth.**

Every portfolio value, holding, net worth calculation, alert, and AI insight originates from recorded transactions.

---

# Core Architecture

The complete financial data flow is:

```text
Transactions
        ↓
Holdings
        ↓
Portfolio
        ↓
Net Worth
        ↓
Analytics
        ↓
Alerts
        ↓
AI Insights
        ↓
Dashboard
```

This flow must never be bypassed.

Every downstream layer is derived from the previous layer.

---

# Transaction Ledger

The ledger represents immutable financial history.

Transactions are the **only manually created financial records**.

Supported transaction types include:

* Stock Purchase
* Stock Sale
* Mutual Fund SIP
* ETF Purchase
* Dividend
* Interest
* Gold Purchase
* Crypto Purchase
* Cash Deposit
* Cash Withdrawal
* Fees
* Taxes
* Transfers
* Adjustments

Transactions are never edited.

Corrections are recorded as new transactions to preserve auditability.

---

# Holdings Layer

Holdings are fully derived from the transaction ledger.

Responsibilities:

* Current Quantity
* Average Cost Basis
* Realized Gain/Loss
* Unrealized Gain/Loss
* Current Market Value

Holdings are projections.

They must never become the primary source of truth.

---

# Portfolio Layer

The portfolio aggregates all holdings across accounts.

Responsibilities:

* Portfolio Value
* Asset Allocation
* Sector Allocation
* Category Allocation
* Broker Allocation
* Performance Metrics

Portfolio values are calculated from holdings and live market prices.

---

# Live Market Pricing

Market prices are external data sources.

Supported providers include:

* Yahoo Finance
* CoinGecko
* AMFI
* Manual Gold Provider

Responsibilities:

* Price snapshots
* Cached prices
* Scheduled refresh
* Stale-price fallback

Price data updates portfolio valuation but never modifies historical transactions.

---

# Net Worth Layer

Net Worth is calculated as:

```text
Assets
−
Liabilities
=
Net Worth
```

Supported Assets:

* Stocks
* ETFs
* Mutual Funds
* Crypto
* Gold
* Cash
* Bank Accounts

Supported Liabilities:

* Loans
* Credit Cards
* Mortgages
* EMIs

Historical net worth snapshots are stored for long-term analysis.

---

# Analytics Layer

Analytics operates on portfolio and net worth data.

Examples include:

* Wealth Score
* Goal Progress
* Retirement Readiness
* Asset Allocation Health
* Historical Growth
* Diversification Analysis

Analytics is read-only.

It never modifies financial records.

---

# Alerts & Notifications

The alert engine continuously evaluates portfolio state.

Alert categories include:

* Portfolio Alerts
* Goal Alerts
* Allocation Alerts
* Market Alerts
* System Alerts

Alerts are generated from deterministic business rules and never modify portfolio data.

---

# AI Layer

The AI Financial Coach is portfolio-aware and advisory only.

AI can:

* Explain portfolio metrics
* Analyze diversification
* Explain alerts
* Explain wealth score
* Summarize financial news
* Generate educational insights

AI cannot:

* Recommend buying assets
* Recommend selling assets
* Predict future prices
* Execute trades
* Modify financial records

The user always remains in control of financial decisions.

---

# News & Sentiment Intelligence

News is linked directly to owned assets.

Workflow:

```text
News Provider
        ↓
Sentiment Analysis
        ↓
Portfolio Exposure
        ↓
Alerts
        ↓
AI Explanation
```

News is informational and advisory.

It never generates trading actions.

---

# Import Architecture

Supported import sources:

* Angel One
* CoinDCX
* Zerodha Kite
* Paytm Money
* PhonePe Gold
* ICICI Prudential

Import flow:

```text
CSV / API
      ↓
Validation
      ↓
Duplicate Detection
      ↓
Normalization
      ↓
Transaction Ledger
      ↓
Holdings
      ↓
Portfolio
      ↓
Dashboard
```

Imports always create transactions.

Imports never create holdings directly.

---

# Background Jobs

Scheduled background jobs power asynchronous processing.

Responsibilities:

* Market price refresh
* Alert evaluation
* AI insight generation
* Import processing
* Snapshot generation

Jobs are isolated from the user interface and operate through service layers.

---

# Technology Stack

## Frontend

* Next.js 15
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Recharts

## Backend

* Next.js API Routes

## Database

* PostgreSQL

## ORM

* Prisma

## Authentication

* Auth.js

## Background Jobs

* Trigger.dev

## AI

* Provider abstraction for OpenAI, Gemini, Claude, and future providers

---

# Engineering Principles

WealthOS follows these architectural principles:

1. The Transaction Ledger is the single source of truth.
2. Transactions are immutable.
3. Holdings are always derived.
4. Every financial calculation is deterministic.
5. AI is advisory only.
6. Business logic is independent of the UI.
7. External data (prices, news) never modifies historical transactions.
8. Every major feature must be testable.
9. Auditability and transparency take precedence over convenience.
10. Long-term maintainability is a core design goal.

No feature should compromise financial accuracy or data integrity.
