# Banking Transactions API — Homework 1

**Author:** Anastasiia

**AI tool:** OpenAI Codex

**Stack:** Node.js 24+, NestJS, TypeScript, Express adapter, Jest, Supertest

A minimal REST API implementing Tasks 1–3 and Task 4 option D from [TASKS.md](TASKS.md). It stores transactions in memory and separates balances by currency. See [HOWTORUN.md](HOWTORUN.md) for setup, tests, and runnable demos.

## Implemented features

- Create transactions, list history, retrieve a transaction, and calculate account balances.
- Validate monetary amounts, account IDs, transaction types, and ISO 4217 currencies.
- Combine account, type, and inclusive UTC date filters.
- Share a limit of 100 requests per minute per IP across all request paths; return HTTP 429 when exceeded.
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

Amounts must be JSON numbers greater than zero with at most two decimal places. Validation and conversion use the parsed number's decimal representation. Transactions store exact integer hundredths internally, including for JPY, following this assignment's two-decimal rule rather than currency-specific minor-unit rules. Amounts and balances must fit within ±9,007,199,254,740,991 hundredths; resulting balances must also retain the same cents when serialized as JSON numbers. Writes that exceed either precision constraint return 400 before storage changes. For example, depositing `90071992547409.9` and withdrawing `90071992547409` leaves exactly `0.9`.

Currency codes must be uppercase ISO 4217 codes recognized by the installed `currency-codes` dataset. Account IDs match `ACC-[A-Za-z0-9]{5}` exactly. Suffixes may contain uppercase or lowercase letters and digits; account identity remains case-sensitive. Transfers between the same account are rejected.

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
  "details": [{"field":"amount","message":"Amount must be a positive number with at most two decimal places within safe monetary precision"}]
}
```

The limiter uses NestJS throttler's in-memory storage with a 60-second TTL and a 60-second block after exceeding the quota. Middleware runs before JSON parsing and routing, so valid requests, validation failures, malformed JSON, and unknown routes share one IP quota. Proxy trust is disabled, so `X-Forwarded-For` cannot reset the quota. IPv4-mapped IPv6 addresses share their IPv4 quota; distinct IPv6 addresses retain independent quotas. Run locally against `127.0.0.1`. Restarting clears both transactions and quotas.

## Manual API requests

With the server running, copy these commands into another terminal on macOS/Linux. `curl -i` shows the HTTP status, headers, and JSON response. These examples use port `3000`; change it if needed.

For the balances below, start with a fresh server and execute each POST once, in the order shown. Manual requests create real in-memory transactions and consume the same rate-limit quota as demos. Restart before running either demo afterwards.

**Deposit 100.50 USD into ACC-12345.** Expected: HTTP `201`, a generated `id`, UTC `timestamp`, and `status: "completed"`.

```bash
curl -i -X POST http://127.0.0.1:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"toAccount":"ACC-12345","amount":100.50,"currency":"USD","type":"deposit"}'
```

**Transfer 20.25 USD to ACC-67890.** Expected: HTTP `201`. USD balances become `80.25` and `20.25`.

```bash
curl -i -X POST http://127.0.0.1:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"fromAccount":"ACC-12345","toAccount":"ACC-67890","amount":20.25,"currency":"USD","type":"transfer"}'
```

**Withdraw 5.25 USD from ACC-67890.** Expected: HTTP `201`; its USD balance becomes `15`.

```bash
curl -i -X POST http://127.0.0.1:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"fromAccount":"ACC-67890","amount":5.25,"currency":"USD","type":"withdrawal"}'
```

**Deposit 50 EUR into ACC-12345.** Expected: HTTP `201`; EUR is tracked separately from USD.

```bash
curl -i -X POST http://127.0.0.1:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"toAccount":"ACC-12345","amount":50,"currency":"EUR","type":"deposit"}'
```

**Read account balances.** Expected: HTTP `200`; `ACC-12345` has `USD 80.25` and `EUR 50`, while `ACC-67890` has `USD 15`.

```bash
curl -i http://127.0.0.1:3000/accounts/ACC-12345/balance
curl -i http://127.0.0.1:3000/accounts/ACC-67890/balance
```

**List all transactions.** Expected: HTTP `200` and the four transactions in creation order.

```bash
curl -i http://127.0.0.1:3000/transactions
```

**Find a transaction by ID.** Paste an `id` from a successful POST response when prompted. Expected: HTTP `200` and that saved transaction.

```bash
printf 'Paste a transaction ID and press Enter: '
read -r TRANSACTION_ID
curl -i "http://127.0.0.1:3000/transactions/$TRANSACTION_ID"
```

**Combine account, type, and date filters.** Expected: HTTP `200` and only the `20.25 USD` transfer, if created today in UTC. Both date boundaries are inclusive.

```bash
DEMO_DAY=$(date -u +%Y-%m-%d)
curl -i --get http://127.0.0.1:3000/transactions \
  --data-urlencode 'accountId=ACC-12345' \
  --data-urlencode 'type=transfer' \
  --data-urlencode "from=$DEMO_DAY" \
  --data-urlencode "to=$DEMO_DAY"
```

**Check invalid amount handling.** Expected: HTTP `400`, `error: "Validation failed"`, and an `amount` detail. History and balances must remain unchanged.

```bash
curl -i -X POST http://127.0.0.1:3000/transactions \
  -H 'Content-Type: application/json' \
  -d '{"toAccount":"ACC-12345","amount":-1,"currency":"USD","type":"deposit"}'
```

**Check missing transaction handling.** Expected: HTTP `404` with an error saying the transaction was not found.

```bash
curl -i http://127.0.0.1:3000/transactions/missing
```

## Structure and extension points

```text
src/
  main.ts                 Startup and port configuration
  app.ts                  Shared HTTP configuration
  app.module.ts           Module composition
  transactions/           DTOs, controller, business service, repository, money helpers
  accounts/               Balance endpoint using the transaction service
  rate-limiting/          IP throttling middleware before JSON parsing and routing
  common/                 Validation and HTTP error formatting
test/                    Money conversion, configured middleware, and HTTP regression tests
demo/                    Startup, sample data, requests, and rate-limit demo
docs/                    AI workflow and screenshot guidance
```

Nest dependency injection keeps routing separate from transaction rules and storage. The transaction repository owns records containing integer hundredths and returns copies with the public numeric amount field. Account balances are derived from the same transaction history, avoiding a second mutable ledger. Each write calculates all affected balances in one pass over one history snapshot, then validates them before saving. History scans remain linear in the number of transactions.

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

Tests cover transaction types, field-level validation, lookup, exact monetary conversion, numeric precision boundaries, case-sensitive alphanumeric accounts, multiple currencies, negative balances, date boundaries, combined filters, rejected-write atomicity, and quotas covering malformed JSON and unknown routes. Configured middleware tests verify IP isolation and timed recovery. See [HOWTORUN.md](HOWTORUN.md) for complete instructions.

## AI workflow and submission evidence

Codex inspected this assignment and the root repository documentation, proposed a plan, and generated the implementation, tests, and docs. The requested stack was refined to NestJS with TypeScript before implementation. [AI workflow notes](docs/AI-WORKFLOW.md) record actual prompts, decisions, and verification results.

Capture 3–5 real screenshots using [the screenshot checklist](docs/screenshots/README.md). Commit images under `docs/screenshots/`; embed them in a detailed submission PR. Screenshots have not been fabricated or supplied by the implementation. The root README also requires the PR to explain features, AI use, challenges, and verification instructions. It asks for instructor review by `Alexey-Popov`. This work does not create or submit a PR.

## Limitations

This is a single-process homework API. Data and rate limits disappear on restart and are not shared across multiple processes. It has no authentication, persistence, currency conversion, or pending transaction workflow. No external credentials or database are required.
