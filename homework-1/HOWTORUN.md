# How to Run

**Required: Node.js 24 or newer, npm, and Bash for `.sh` scripts.** Node.js and npm must already be installed. Internet access is needed to install project dependencies. No database, API keys, or `.env` file are required.

Run the following commands from the repository root.

## 1. Prepare and start the API

In terminal 1:

```bash
./homework-1/demo/run.sh
```

The script runs these steps in order:

1. `npm ci` — installs exact lockfile dependencies, replacing `node_modules` on every run.
2. `npm run typecheck` — checks application and test types.
3. `npm run build` — compiles the application into `dist/`.
4. `npm test` — runs the complete Jest suite.
5. `npm run start:prod` — starts the compiled API.

A failed preparation step prints `FAIL` and stops the script before API startup. Wait for `Banking API running at http://127.0.0.1:3000`. Keep this terminal open; Ctrl+C stops the server.

## 2. Run transaction checks

In terminal 2:

```bash
./homework-1/demo/sample-requests.sh
```

This wrapper runs `sample-requests.mjs` through Node.js. It sends requests to the running API and performs 14 checks: transaction creation, generated fields, lookup, history filtering, balances, invalid amounts, unchanged state after rejection, and missing transactions.

Each step prints its meaning, expected response, actual JSON, and `PASS` or `FAIL`. Expected HTTP `400` and `404` responses count as passing checks. Successful completion prints:

```text
PASS: All 14 transaction demo checks passed.
```

Restart the server before repeating this demo: it requires empty storage. Restarting clears all transactions and rate-limit counters.

## 3. Run rate-limit checks

Before starting this demo, either wait at least one minute after the last request without sending any other requests, or restart the server to clear its rate-limit counters. To restart without repeating installation, build, and tests, stop the server with Ctrl+C and run the following in terminal 1 from the repository root:

```bash
cd homework-1
npm start
```

Wait for the server's ready message. Then run the demo in terminal 2 from the repository root, without sending other requests during the check:

```bash
node homework-1/demo/rate-limit.mjs
```

The script sends 101 requests sequentially across history and balance routes. It checks that requests 1–100 return HTTP `200`, request 101 returns HTTP `429` with a positive `Retry-After`, and all requests finish in less than 60 seconds. It prints actual responses, elapsed time, and `PASS` or `FAIL`.

Both demos stop at the first failed check and exit with code `1`; successful runs exit with code `0`.

For copyable `curl` examples and expected responses, see [Manual API requests in README.md](README.md#manual-api-requests).

## Alternative: npm commands without run.sh

Use these instead of `run.sh`, running each command only after the previous one succeeds:

```bash
cd homework-1
npm ci
npm run typecheck
npm run build
npm test
npm run start:prod
```

After installing dependencies, `npm start` runs directly from TypeScript; `npm run start:dev` also restarts on source changes. These commands do not run the preparation checks.

Without Bash, run the transaction demo directly from the repository root:

```bash
node homework-1/demo/sample-requests.mjs
```

## Another port

On macOS/Linux, use matching server and demo addresses:

```bash
# Terminal 1, from the repository root
PORT=3001 ./homework-1/demo/run.sh

# Terminal 2, after the server is ready
BASE_URL=http://127.0.0.1:3001 ./homework-1/demo/sample-requests.sh
```

`BASE_URL` also applies to the rate-limit demo. If connection fails, check that the server is running on the expected port. If requests return an unexpected `429`, restart the server or wait for the `Retry-After` delay.
