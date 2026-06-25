# Changelog

All notable changes to WealthOS will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) where appropriate, and this project uses semantic versioning during pre-1.0 development.

## [Unreleased]

### Added

- Repository contribution guidelines.
- Security policy and vulnerability reporting guidance.
- Project changelog.

## [0.8.0] - News & Sentiment Intelligence

### Added

- News ingestion tied to portfolio holdings.
- Support for news by symbol or company for stocks, ETFs, and crypto.
- Prisma persistence for news articles and linked assets.
- Deterministic sentiment classification as positive, neutral, or negative.
- Alerts for strong negative sentiment and significant news events.
- AI Coach context for explaining news alerts and portfolio exposure.
- Caching, rate limiting, API failure handling, and empty portfolio support.

## [0.7.0] - AI Financial Coach

### Added

- Portfolio-aware AI coach for educational explanations and analysis.
- Deterministic prompt builders and context generation.
- Periodic insights for diversification, concentration, savings, and goal tracking.
- Contextual answers using holdings, net worth, goals, alerts, and price movements.
- Prisma persistence for AI insights.
- Safety checks preventing buy/sell recommendations, price predictions, and trade execution language.

## [0.6.0] - Alerts & Notifications

### Added

- Rules-based alert engine derived from portfolio state.
- Price alerts for daily percentage movement and threshold breaches.
- Portfolio alerts for concentration risk and allocation drift.
- Goal and retirement readiness alerts.
- System alerts for stale prices and import failures.
- Prisma alert persistence, read/unread support, aggregation APIs, and scheduled evaluation jobs.

## [0.5.0] - Live Market Pricing

### Added

- Pricing abstraction layer for external market data.
- Price snapshot persistence.
- Support for stocks, ETFs, mutual funds, crypto, and gold.
- Provider integrations and manual fallback paths.
- Scheduled refresh jobs with caching and rate limiting.
- Stale price handling and graceful provider failure behavior.

## [0.4.0] - Real Dashboard

### Added

- Prisma-backed dashboard data.
- Ledger-derived dashboard metrics for total assets, liabilities, net worth, allocation, holdings, gain/loss, and portfolio value.
- Insights API integration with real portfolio data.
- Zero-state handling for empty databases.

### Removed

- Production dependency on mock wealth data for dashboard paths.

## [0.3.0] - CSV -> Ledger

### Added

- Broker-specific CSV mappers.
- Normalized transaction conversion layer.
- Idempotent import handling with stable transaction identifiers.
- Prisma-backed transaction persistence from imports.
- Holdings recomputation after import.
- Tests for import mapping and persistence behavior.

## [0.2.0] - Ledger Engine

### Added

- Transaction ledger domain model.
- Holdings derivation from transactions.
- Portfolio valuation.
- Net worth snapshot calculations.
- Ledger test suite covering transactions, holdings, valuation, snapshots, gains, and oversell rejection.

## [0.1.0] - Foundation

### Added

- Initial WealthOS application foundation.
- Next.js, TypeScript, Tailwind, shadcn/ui, Prisma, PostgreSQL, Auth.js, and Trigger.dev architecture.
- Product vision, roadmap, architecture, and data model documentation.
- Initial domain calculation modules for wealth score, goals, retirement, and net worth.

