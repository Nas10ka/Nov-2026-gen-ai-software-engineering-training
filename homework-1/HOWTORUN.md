# How to Run

## Prerequisites

- Node.js 24 or newer, with npm.
- Internet access for the initial dependency installation.
- Bash for `.sh` wrappers; direct npm and Node commands also work on Windows.
- An available local TCP port, default `3000`.

All project commands below run inside `homework-1` unless stated otherwise. No database, API keys, or `.env` file are needed.

## Install

From the repository root:

```bash
cd homework-1
node --version
npm ci
```

`npm ci` uses the committed dependency lockfile. Do not install dependencies from the repository root.

## Start

```bash
npm start
```

The server binds to `http://127.0.0.1:3000` and prints its URL. Stop it with Ctrl+C. For automatic restart during development:

```bash
npm run start:dev
```

To build and run compiled JavaScript:

```bash
npm run build
npm run start:prod
```

To use another port on macOS/Linux:

```bash
PORT=3001 npm start
```

PowerShell equivalent:

```powershell
$env:PORT = '3001'
npm start
```

`PORT` must be an integer from 1 to 65535. Environment variables come from the shell; the app does not load `.env` files. Production startup requires an existing build.

## Verify

```bash
npm run typecheck
npm run build
npm test
```

Tests create isolated applications and repositories. Do not start a separate server for tests. Limiter expiry tests use a controlled clock rather than waiting a minute.

## Run the transaction demo

Start a fresh server in terminal 1. The wrapper works from any directory:

```bash
./homework-1/demo/run.sh
```

In terminal 2, from the repository root:

```bash
./homework-1/demo/sample-requests.sh
```

Without Bash, use:

```bash
node homework-1/demo/sample-requests.mjs
```

The script loads `sample-data.json` through POST requests, prints responses, and checks transaction lookup, combined history filters, balances, validation, and 404 handling. Expected balances are:

- `ACC-12345`: USD 80.25, EUR 50.
- `ACC-67890`: USD 15.

It stops with an error if storage is not initially empty. Restart the server before rerunning; repeated requests would otherwise create duplicate transactions.

For another server port on macOS/Linux:

```bash
BASE_URL=http://127.0.0.1:3001 node homework-1/demo/sample-requests.mjs
```

In PowerShell, set `$env:BASE_URL = 'http://127.0.0.1:3001'` first.

For manual exploration, open `demo/sample-requests.http` with a compatible REST client extension. Replace the transaction ID and date range as instructed in the file. Alternatively:

```bash
curl -i http://127.0.0.1:3000/transactions
curl -i -X POST http://127.0.0.1:3000/transactions   -H 'Content-Type: application/json'   -d '{"toAccount":"ACC-12345","amount":100.50,"currency":"USD","type":"deposit"}'
curl -i http://127.0.0.1:3000/accounts/ACC-12345/balance
```

## Run the rate-limit demo

Stop and restart the server first. Do not run other requests against it during this demo.

From the repository root:

```bash
node homework-1/demo/rate-limit.mjs
```

The script alternates between two routes. Requests 1–100 return 200; request 101 returns 429 with `Retry-After`. The script fails if an unexpected status appears. `BASE_URL` also applies to this demo. Restart the server afterwards or respect the returned retry delay.

## Screenshots and submission

Follow [docs/screenshots/README.md](docs/screenshots/README.md). Capture actual AI interactions, the server, sample requests, validation, and tests or throttling. Put images in that directory and embed 3–5 in the submission PR. See [AI workflow notes](docs/AI-WORKFLOW.md) for the development record.

## Troubleshooting

| Problem | Action |
| --- | --- |
| `EADDRINUSE` | Stop the existing server or choose another `PORT`. |
| Connection refused | Start the API and check that `BASE_URL` matches its port. |
| HTTP 429 during normal demos | Restart the server or wait for `Retry-After`. |
| Demo says storage is not empty | Restart the server; it uses in-memory storage. |
| Missing modules | Run `npm ci` inside `homework-1`. |
| `dist/main.js` missing | Run `npm run build` before `npm run start:prod`. |
| Invalid account | Use `ACC-` plus exactly five letters or digits. Letter case is preserved and distinguishes accounts. |
| No results for date filters | Use UTC dates containing your generated timestamps. |

Restarting deliberately deletes all transactions and rate-limit counters. The service binds to the local loopback interface and does not trust proxy headers.
