#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -d node_modules ]]; then
  echo "Install dependencies first: cd homework-1 && npm ci" >&2
  exit 1
fi
exec npm start
