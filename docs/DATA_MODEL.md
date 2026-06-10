# WealthOS Data Model

## Overview

This document describes the core entities used by WealthOS and how they relate to each other.

The transaction ledger is the source of truth.

Data Flow:

Transactions
→ Holdings
→ Portfolio
→ Net Worth
→ Analytics

---

# User

## Purpose

Represents a WealthOS user.

## Relationships

User
→ Accounts
→ Goals
→ Transactions
→ NetWorthSnapshots

## Future Extensions

* Family Accounts
* Shared Portfolios
* Multiple Profiles

---

# Account

## Purpose

Represents a financial account or investment platform.

## Examples

* Angel One
* CoinDCX
* Zerodha Kite
* Paytm Money
* PhonePe Gold
* ICICI Prudential

## Relationships

Account
→ Transactions
→ Holdings

## Future Extensions

* API Sync
* Last Sync Status
* Import History

---

# Asset

## Purpose

Represents an investable asset.

## Examples

* Stocks
* ETFs
* Mutual Funds
* Crypto
* Gold
* Cash

## Relationships

Asset
→ Transactions
→ Holdings

## Future Extensions

* Live Prices
* Sector Classification
* Risk Classification

---

# Transaction

## Purpose

Source of truth for all financial activity.

## Examples

* Buy
* Sell
* SIP
* Dividend
* Interest
* Deposit
* Withdrawal

## Relationships

Transaction
→ Account
Transaction
→ Asset

## Rules

Transactions create holdings.

Holdings must never replace transactions as the source of truth.

---

# Holding

## Purpose

Represents the current position derived from transactions.

## Calculated Values

* Quantity
* Average Cost
* Realized Gain/Loss
* Unrealized Gain/Loss

## Relationships

Holding
→ Account
Holding
→ Asset

---

# Goal

## Purpose

Represents a financial objective.

## Examples

* Emergency Fund
* House Purchase
* Retirement
* Car Purchase

## Relationships

Goal
→ User

---

# NetWorthSnapshot

## Purpose

Stores historical net worth values.

## Data Stored

* Assets
* Liabilities
* Net Worth
* Cash
* Investments

## Future Usage

* Historical Charts
* CAGR
* Wealth Growth Tracking

---

# ImportJob

## Purpose

Tracks CSV imports and future broker synchronizations.

## Responsibilities

* Validation
* Duplicate Detection
* Import Status
* Error Tracking

## Future Extensions

* API Imports
* Scheduled Sync

---

# AI Insight

## Purpose

Stores AI-generated financial observations.

## Rules

AI can:

* Explain
* Educate
* Analyze
* Summarize

AI cannot:

* Recommend buys
* Recommend sells
* Predict prices

---

# Design Principles

1. Transaction Ledger is the source of truth.
2. Financial calculations must be deterministic.
3. Data integrity is more important than convenience.
4. Holdings are derived from transactions.
5. Net worth is derived from assets and liabilities.
