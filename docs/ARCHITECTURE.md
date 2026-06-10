# WealthOS Architecture

## Overview

WealthOS is a personal wealth operating system.

The system is designed around a single principle:

Transaction Ledger is the source of truth.

Every financial calculation originates from recorded transactions.

---

## Core Data Flow

Transactions
→ Holdings
→ Portfolio
→ Net Worth
→ Analytics

The system must never bypass this flow.

---

## Source of Truth

### Transactions

Transactions are the only manually created financial records.

Examples:

* Stock Purchase
* Stock Sale
* Mutual Fund SIP
* Dividend
* Interest
* Gold Purchase
* Crypto Purchase
* Cash Deposit
* Cash Withdrawal

All other financial information is derived.

---

## Holdings Layer

Holdings are calculated from transactions.

Responsibilities:

* Current Quantity
* Average Cost Basis
* Realized Gain/Loss
* Unrealized Gain/Loss

Holdings must never become the primary source of truth.

---

## Portfolio Layer

Portfolio combines all holdings.

Responsibilities:

* Portfolio Value
* Asset Allocation
* Sector Allocation
* Category Allocation
* Performance Metrics

Portfolio values are derived from holdings.

---

## Net Worth Layer

Net Worth combines:

Assets
−
Liabilities

Examples:

Assets

* Stocks
* ETFs
* Mutual Funds
* Crypto
* Gold
* Cash
* Bank Accounts

Liabilities

* Loans
* Credit Cards
* Mortgages

Net Worth is derived from assets and liabilities.

---

## Analytics Layer

Analytics sits on top of net worth.

Examples:

* Wealth Score
* Goal Progress
* Retirement Readiness
* Asset Allocation Health
* Historical Growth

Analytics never modifies source data.

---

## Import Architecture

External Sources

* Angel One
* CoinDCX
* Zerodha Kite
* Paytm Money
* PhonePe Gold
* ICICI Prudential

Import Flow

CSV/API
→ Import Engine
→ Validation
→ Duplicate Detection
→ Transactions
→ Holdings
→ Portfolio

Imports must always create transactions.

Imports must never directly create holdings.

---

## AI Layer

AI is advisory only.

AI can:

* Explain
* Analyze
* Educate
* Summarize
* Identify risks

AI cannot:

* Recommend buying
* Recommend selling
* Predict prices
* Execute trades

---

## Technology Stack

Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui

Backend

* Next.js API Routes

Database

* PostgreSQL

ORM

* Prisma

Authentication

* Auth.js

Background Jobs

* Trigger.dev

---

## Design Principles

1. Data Integrity First
2. Deterministic Financial Calculations
3. Auditability
4. Test Coverage
5. Long-Term Maintainability

No feature should compromise financial accuracy.
