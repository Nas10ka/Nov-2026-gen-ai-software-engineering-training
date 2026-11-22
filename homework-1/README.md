# Banking Transactions API — Homework 1

**Author:** Anastasiia

**AI tool:** OpenAI Codex

**Stack:** Node.js 24+, NestJS, TypeScript, Express adapter, Jest, Supertest

A minimal REST API implementing Tasks 1–3 and Task 4 option D from [TASKS.md](TASKS.md). It stores transactions in memory and separates balances by currency. See [HOWTORUN.md](HOWTORUN.md) for setup, tests, and runnable demos.

## Implemented features

- Create transactions, list history, retrieve a transaction, and calculate account balances.
- Validate monetary amounts, account IDs, transaction types, and ISO 4217 currencies.
- Combine account, type, and inclusive UTC date filters.
- Share a limit of 100 requests per minute per IP across API routes; return HTTP 429 when exceeded.
- Return useful JSON errors, including field-level validation details.

Options A (summary), B (interest), and C (CSV export) are not implemented yet.

## API

| Method | Route | Success |
| --- | --- | --- |
| POST | `/transactions` | 201, created transaction |
| GET | `/transactions` | 200, transaction array |
| GET | `/transactions/:id` | 200, transaction |
| GET | `/accounts/:accountId/balance` | 200, balances by currency |

Create a transfer:

```json
{
  "fromAccount": "ACC-12345",
  "toAccount": "ACC-67890",
  "amount": 20.25,
  "currency": "USD",
  "type": "transfer"
}
```

The response adds a server-generated UUID, UTC ISO 8601 `timestamp`, and `status: "completed"`. Deposits require only `toAccount`; withdrawals require only `fromAccount`; transfers require both. Responses use `null` for an absent account field. Irrelevant account fields, unknown properties, and client-supplied generated fields are rejected.

Amounts must be JSON numbers greater than zero with at most two decimal places. The API uses integer hundredths internally, including for JPY, following this assignment's two-decimal rule rather than currency-specific minor-unit rules. Unsafe amounts and resulting balances are rejected. Currency codes must be uppercase ISO 4217 codes recognized by the installed `currency-codes` dataset. Account IDs match `ACC-[A-Z0-9]{5}` exactly. Transfers between the same account are rejected.

Example balance response:

```json
{"accountId":"ACC-12345","balances":{"USD":80.25,"EUR":50}}
```

Deposits credit recipients, withdrawals debit senders, and transfers do both. Currencies are never converted or added together. Negative balances are allowed; there is no separate account registry or insufficient-funds check. A valid account with no activity returns an empty `balances` object. All successful transactions complete immediately; pending and failed lifecycle handling is outside this assignment.

### Transaction history

```text
GET /transactions?accountId=ACC-12345&type=transfer&from=2024-01-01&to=2024-01-31
```

All filters are optional and combine using AND logic. `accountId` matches either side of a transaction. Dates use `YYYY-MM-DD` and include the entire start and end days in UTC. Invalid calendar dates, reversed ranges, repeated filter parameters, and unknown filters return 400. Results preserve creation order; no matches return `[]`.

### Errors and rate limiting

- **400:** Invalid input or malformed JSON.
- **404:** Missing transaction or unknown route.
- **429:** Per-IP quota exceeded; inspect `Retry-After` before retrying.
- **500:** Unexpected server error; details are logged rather than exposed.

Validation example:

```json
{
  "error": "Validation failed",
  "details": [{"field":"amount","message":"amount must not be less than 0.01"}]
}
```

The limiter uses NestJS throttler's in-memory TTL and blocking behavior. Recognized API routes share one IP key, including requests rejected by validation. Unknown routes are handled by Nest's 404 handler outside the route guard. Proxy trust is disabled, so `X-Forwarded-For` cannot reset the quota. Run locally against `127.0.0.1`. Restarting clears both transactions and quotas.

## Structure and extension points

```text
src/
  main.ts                 Startup and port configuration
  app.ts                  Shared HTTP configuration
  app.module.ts           Module composition
  transactions/           DTOs, controller, business service, repository, money helpers
  accounts/               Balance endpoint using the transaction service
  rate-limiting/          Global IP throttling guard
  common/                 Validation and HTTP error formatting
test/                    Service/storage and end-to-end HTTP tests
demo/                    Startup, sample data, requests, and rate-limit demo
docs/                    AI workflow and screenshot guidance
```

Nest dependency injection keeps routing separate from transaction rules and storage. The transaction repository owns stored records and returns copies. Account balances are derived from the same transaction history, avoiding a second mutable ledger. Writes validate all affected balances before saving.

Future summary and interest endpoints can extend account services; CSV export can extend transaction routes. Add `/transactions/export` before the dynamic ID route when implementing option C. There are no placeholder feature implementations or database dependencies.

## Verification and demos

```bash
cd homework-1
npm ci
npm run typecheck
npm run build
npm test
npm start
```

In a second terminal, from the repository root:

```bash
./homework-1/demo/sample-requests.sh
```

Restart the API before each automated demo. For the quota demo:

```bash
node homework-1/demo/rate-limit.mjs
```

Tests cover transaction types, validation, lookup, decimal arithmetic, multiple currencies, negative balances, date boundaries, combined filters, rejected-write atomicity, shared quotas, IP isolation, and limiter expiry. See [HOWTORUN.md](HOWTORUN.md) for complete instructions.

## AI workflow and submission evidence

Codex inspected this assignment and the root repository documentation, proposed a plan, and generated the implementation, tests, and docs. The requested stack was refined to NestJS with TypeScript before implementation. [AI workflow notes](docs/AI-WORKFLOW.md) record actual prompts, decisions, and verification results.

Capture 3–5 real screenshots using [the screenshot checklist](docs/screenshots/README.md). Commit images under `docs/screenshots/`; embed them in a detailed submission PR. Screenshots have not been fabricated or supplied by the implementation. The root README also requires the PR to explain features, AI use, challenges, and verification instructions. It asks for instructor review by `Alexey-Popov`. This work does not create or submit a PR.

## Limitations

This is a single-process homework API. Data and rate limits disappear on restart and are not shared across multiple processes. It has no authentication, persistence, currency conversion, or pending transaction workflow. No external credentials or database are required.
