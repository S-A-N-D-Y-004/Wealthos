# Contributing to WealthOS

WealthOS is a personal wealth operating system built around one core rule: the transaction ledger is the source of truth. Contributions should protect financial correctness, deterministic calculations, and long-term maintainability.

## Branch Naming

Use short, descriptive branch names with one of these prefixes:

- `feature/<short-description>` for new user-facing capability.
- `fix/<short-description>` for bug fixes.
- `docs/<short-description>` for documentation-only changes.
- `test/<short-description>` for test-only work.
- `refactor/<short-description>` for internal improvements with no behavior change.
- `codex/<short-description>` for Codex-assisted implementation branches.

Examples:

- `feature/live-market-prices`
- `fix/oversell-validation`
- `docs/security-policy`
- `codex/news-sentiment-intelligence`

## Commit Messages

Use clear, imperative commit messages. Keep the first line concise and describe what changed.

Preferred format:

```text
Add ledger valuation tests
Fix CSV import idempotency
Document security reporting policy
```

Guidelines:

- Use present-tense imperative language, such as `Add`, `Fix`, `Update`, or `Document`.
- Keep unrelated changes in separate commits.
- Do not include generated files unless they are required by the change.
- Mention data model or migration impact in the commit body when relevant.

## Pull Request Workflow

1. Create a branch from the latest `main`.
2. Keep the change focused on one issue or feature.
3. Ensure all quality gates pass locally.
4. Open a pull request with:
   - Summary of the change.
   - Tests run.
   - Data model or migration notes, if any.
   - Screenshots for UI changes, if useful.
5. Request review before merging.
6. Do not merge changes that weaken ledger integrity or bypass deterministic calculations.

Pull requests must not introduce production paths that mutate derived holdings directly. Holdings must remain derived from transactions.

## Testing Requirements

Run the standard checks before requesting review:

```bash
npm run typecheck
npm test
npm run build
```

When the Prisma schema changes, also validate the schema:

```bash
npx prisma validate
```

If `DATABASE_URL` is not set locally, use a safe placeholder only for validation:

```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/wealthos" npx prisma validate
```

Testing expectations:

- Financial calculations must have deterministic unit tests.
- Ledger behavior must cover edge cases such as oversells, fees, taxes, splits, transfers, and adjustments where applicable.
- Import tests must avoid external APIs and use deterministic fixtures.
- Provider integrations must be tested through mocked fetch/provider interfaces.
- Empty database and missing-data paths must not crash.

## Coding Standards

- Use TypeScript with strict types.
- Prefer existing project patterns over new abstractions.
- Keep money in minor units where possible.
- Avoid floating-point arithmetic for money.
- Keep calculations deterministic and testable.
- Keep external data separate from ledger state.
- Do not add buy, sell, target price, or trade execution recommendations.
- Do not directly mutate holdings when they can be derived from transactions.
- Keep API routes thin and place reusable logic in `lib/`.
- Use explicit provider interfaces for external services.
- Handle provider/API failure gracefully.

## Documentation Updates

Update documentation when a change affects:

- Architecture or data flow.
- Prisma schema or data model.
- Ledger behavior.
- Import formats or broker support.
- Market price, news, AI, or alert provider behavior.
- Environment variables.
- Security, authentication, or secret handling.
- User-visible workflows.

Relevant docs include:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/ROADMAP.md`
- `docs/VISION.md`
- `CHANGELOG.md`

