#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
MIN_JOBS="${MIN_JOBS:-1}"

if ! [[ "$MIN_JOBS" =~ ^[0-9]+$ ]]; then
  echo "MIN_JOBS must be a non-negative integer (received: $MIN_JOBS)" >&2
  exit 1
fi

RESPONSE_FILE="$(mktemp)"
cleanup() {
  rm -f "$RESPONSE_FILE"
}
trap cleanup EXIT

curl -fsS "$BASE_URL/api/jobs" > "$RESPONSE_FILE"

node - "$RESPONSE_FILE" "$MIN_JOBS" <<'NODE'
const { readFileSync } = require("fs");

const [, , filePath, minJobsRaw] = process.argv;
const minJobs = Number(minJobsRaw);

const payload = JSON.parse(readFileSync(filePath, "utf8"));

if (payload.error) {
  console.error(`Readiness check failed: upstream error present -> ${payload.error}`);
  process.exit(1);
}

if (!Array.isArray(payload.jobs)) {
  console.error("Readiness check failed: payload.jobs is not an array.");
  process.exit(1);
}

if (payload.jobs.length < minJobs) {
  console.error(`Readiness check failed: expected at least ${minJobs} jobs but received ${payload.jobs.length}.`);
  process.exit(1);
}

console.log(
  `Readiness check passed: provider=${payload.provider ?? "unknown"}, source=${payload.source ?? "unknown"}, jobs=${payload.jobs.length}`
);
NODE
