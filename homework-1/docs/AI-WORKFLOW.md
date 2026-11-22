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

## Verification

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
