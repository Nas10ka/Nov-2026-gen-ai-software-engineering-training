# AI-Assisted Development Record

## Tool and author

- Author: Anastasiia, using the repository's configured Git author name.
- Assistant: OpenAI Codex.
- Source requirements: `TASKS.md` and the repository root `README.md`.

## Actual prompts and decisions

The user requested work only inside `homework-1`, using Node.js, implementing Tasks 1–3 and Task 4 option D. The request also required a `.gitignore`, completed README and run instructions, demo files, screenshot suggestions, and an extensible structure.

During planning, the user selected:

- **“NestJS + TS”** as the stack.
- Separate balances for each currency, without conversion or insufficient-funds checks.
- Type-specific account fields for deposits, withdrawals, and transfers.

The user then instructed: **“Please implement the plan.”**

Codex read the assignment, checked the existing folder and root documentation, consulted official NestJS validation and throttling documentation, and proposed the accepted implementation plan. It generated modules, DTO validation, transaction storage and services, HTTP error handling, tests, runnable demos, and documentation.

## Design and corrections

- Integer hundredths avoid repeated floating-point addition in account balances.
- A custom throttler key shares the IP quota across routes instead of granting each route a separate allowance.
- DTO validation rejects client-generated IDs, timestamps, and statuses.
- Account balances derive from the same stored transaction history.
- Startup uses TypeScript compilation through `ts-node`, preserving decorator metadata needed by NestJS.
- Initial dependency installation found an unavailable `@types/currency-codes` package. The unavailable package was removed before retrying installation.

## Initial implementation verification

Actual verification performed:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: 2 suites and 33 tests passed. HTTP tests required local socket access outside the restricted execution sandbox.
- `bash -n demo/run.sh demo/sample-requests.sh`: passed.
- `npm audit --omit=dev`: no reported runtime dependency vulnerabilities. Installation reported 18 moderate advisories in development dependencies; the runtime-only audit does not clear those.
- `npm start`: successfully initialized all modules and bound to `127.0.0.1:3000` outside the sandbox.
- The sample demo could not reach localhost from the sandbox. Permission to rerun that demo outside the sandbox was denied. Neither complete live demo has been verified; the API paths and quota behavior are covered by the passing HTTP tests.
- Screenshots remain a manual submission step; see [the checklist](screenshots/README.md).

## Human review before submission

Review the transaction rules, run the documented commands, inspect error responses, and capture real screenshots. The repository root requires a detailed PR describing features, AI use, challenges, verification, and visual evidence. Do not claim personal verification or comparisons with AI tools that were not performed.

## Review fixes and verification — 2026-11-22

The user requested implementation of the review fixes and selected code, tests, and documentation only. Screenshots, commits, and PR updates remain outside this change.

- The expanded baseline suite reproduced 17 failures out of 92 tests, covering monetary rounding, tiny-number validation, mixed-case accounts, and rate-limit bypasses.
- Decimal representations now convert exactly to integer hundredths. The repository stores hundredths and exposes the existing numeric API fields. Writes reject unsafe integer balances and balances that would lose cents in a JSON numeric response.
- Amount validation rejects tiny exponential numbers with field-level 400 responses instead of throwing. Alphanumeric account suffixes support both letter cases while preserving identity.
- Injectable middleware replaces the route guard and runs before JSON parsing and routing. It shares the configured Nest throttler storage across normal requests, errors, and unknown routes. Tests exercise the configured middleware, including IP normalization, isolation, and controlled expiry.
- Transfer validation computes both affected balances in one scan of a history snapshot; no separate mutable ledger was added. Existing history fixtures already distinguish accounts, types, and dates and assert exact returned records.
- `npm run typecheck` and `npm run build`: passed.
- `npm test -- --no-cache`: 5 suites, 124 tests passed. HTTP tests ran outside the socket-restricted sandbox.
- Both live demos passed against separate fresh compiled servers on temporary loopback ports: `demo/sample-requests.mjs` checked transactions, balances, filtering, and errors; `demo/rate-limit.mjs` confirmed requests 1–100 succeeded and request 101 returned 429 with `Retry-After: 60`. Both servers were shut down afterwards.

This follow-up verification supersedes the initial live-demo limitation above. Screenshot capture and PR evidence are still manual submission steps.
