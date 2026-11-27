#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "FAIL: Install Node.js 24 or newer with npm before running this script." >&2
  exit 1
fi
task_node_major=$(node -p 'process.versions.node.split(".")[0]')
if (( task_node_major < 24 )); then
  echo "FAIL: Node.js 24 or newer is required. Installed: $(node --version)." >&2
  exit 1
fi

step="Preparation"
trap 'echo "FAIL: ${step}. Stopping before API startup; fix the error above and rerun." >&2' ERR

run_step() {
  step="$1"
  shift
  echo
  echo "$step"
  "$@"
  echo "PASS: $step"
}

echo "Preparing the banking API: install dependencies, check types, build, run tests, then start."
run_step "Step 1/5: Install exact lockfile dependencies (npm ci)" npm ci
run_step "Step 2/5: Check application and test types (npm run typecheck)" npm run typecheck
run_step "Step 3/5: Build JavaScript into dist/ (npm run build)" npm run build
run_step "Step 4/5: Run the complete Jest suite (npm test)" npm test

step="Step 5/5: Start the compiled API (npm run start:prod)"
echo
echo "$step"
echo "Starting the banking API on http://127.0.0.1:${PORT:-3000}."
echo "Expected: a 'Banking API running at' message once the server is ready."
echo "This terminal runs the server; no demo transactions are sent here."
echo "In another terminal, run ./homework-1/demo/sample-requests.sh from the repository root."
echo "The demo prints each request's meaning, expected response, actual response, and PASS/FAIL result."
echo "Press Ctrl+C to stop. Restarting clears all transactions and rate-limit counters."
exec npm run start:prod
