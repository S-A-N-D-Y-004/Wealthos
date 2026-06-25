# Security Policy

WealthOS handles sensitive personal finance data. Security work should prioritize confidentiality, integrity, auditability, and predictable behavior.

## Supported Versions

WealthOS is currently pre-1.0. Security fixes are applied to the active `main` branch.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older branches | No |

## Reporting Vulnerabilities

Do not open public issues for suspected vulnerabilities.

Report security concerns privately to the repository owner or maintainer. Include:

- A clear description of the issue.
- Steps to reproduce, if known.
- Potential impact.
- Affected files, routes, providers, or dependencies.
- Suggested remediation, if available.

Maintainers should acknowledge valid reports, assess impact, prepare a fix privately when needed, and disclose responsibly after remediation.

## Security Principles

- The transaction ledger is the source of truth.
- Derived data, including holdings and alerts, must not be treated as authoritative ledger records.
- External data such as prices, news, and AI output must never mutate financial history.
- AI output is advisory only and must not recommend buying, selling, predicting prices, or executing trades.
- All financial calculations must be deterministic and auditable.

## Secret Management

Never commit secrets to the repository.

Examples of secrets:

- Database URLs and credentials.
- Auth.js secrets.
- OAuth client secrets.
- API keys for market data, news, AI, storage, or broker integrations.
- R2 or object-storage credentials.
- Webhook signing secrets.

Use environment variables for secrets. Rotate credentials immediately if they are exposed.

Recommended practices:

- Keep `.env` files out of git.
- Use separate credentials for development, staging, and production.
- Use least-privilege API keys.
- Rotate provider keys periodically.
- Avoid logging secrets or full request headers.
- Avoid returning secrets from API routes.

## Environment Variables

Required and optional environment variables should be documented when introduced.

Common categories:

- `DATABASE_URL` for PostgreSQL.
- Auth.js configuration and secrets.
- AI provider keys.
- Market price provider keys.
- News provider keys.
- Object storage credentials.
- Trigger.dev configuration.

Environment variables should be read server-side only unless explicitly intended for public browser use. Public variables must use the framework's public naming convention and must not contain secrets.

## Authentication Guidance

WealthOS uses Auth.js. Authentication changes should:

- Preserve server-side session validation for protected routes.
- Avoid trusting client-provided user IDs.
- Scope database queries by the authenticated user.
- Avoid exposing another user's accounts, transactions, holdings, alerts, goals, liabilities, insights, or news.
- Use provider callbacks carefully and keep session data minimal.
- Treat credentials and tokens as sensitive data.

API routes that read or write user data must validate the current session before returning personalized data or mutating records.

## Dependency Updates

Keep dependencies current, especially:

- Next.js
- React
- Auth.js
- Prisma
- Trigger.dev
- Provider SDKs
- Testing and build tooling

When updating dependencies:

- Review release notes for security fixes and breaking changes.
- Run `npm install` to refresh the lockfile.
- Run `npm run typecheck`, `npm test`, and `npm run build`.
- Validate Prisma schema if ORM behavior or schema files are affected.
- Avoid broad dependency updates mixed with unrelated feature work.

## Responsible AI and External Data

AI, market prices, and news sentiment are advisory inputs. They must not:

- Modify transactions.
- Modify derived holdings directly.
- Execute trades.
- Recommend buying or selling.
- Predict target prices.
- Override deterministic WealthOS calculations.

Provider failures must degrade gracefully without corrupting ledger state.

