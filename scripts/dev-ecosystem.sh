#!/usr/bin/env bash
# Start Wolf local ecosystem: API + Portal + Finance + HR
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export WOLF_API_ORIGIN="${WOLF_API_ORIGIN:-http://127.0.0.1:4000}"
export WOLF_JWKS_URL="${WOLF_JWKS_URL:-$WOLF_API_ORIGIN/.well-known/jwks.json}"
export WOLF_DB_PATH="${WOLF_DB_PATH:-$ROOT/apps/api/data/wolf.sqlite}"
export WOLF_CORS_ORIGIN="${WOLF_CORS_ORIGIN:-http://localhost:3100,http://127.0.0.1:3100,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3200,http://127.0.0.1:3200}"
export NEXT_PUBLIC_FINANCE_URL="${NEXT_PUBLIC_FINANCE_URL:-http://localhost:3000}"
export NEXT_PUBLIC_HR_URL="${NEXT_PUBLIC_HR_URL:-http://localhost:3200}"
export PORT_API="${PORT_API:-4000}"
export PORT_PORTAL="${PORT_PORTAL:-3100}"
export PORT_FINANCE="${PORT_FINANCE:-3000}"
export PORT_HR="${PORT_HR:-3200}"

mkdir -p /tmp/wolf-ecosystem-logs "$ROOT/apps/api/data"

echo "Installing workspace deps (if needed)…"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "Seeding Wolf API (fake users)…"
pnpm --filter @wolf/api seed || true

pids=()
cleanup() {
  echo "Stopping ecosystem…"
  for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

echo "Starting API :$PORT_API"
PORT="$PORT_API" WOLF_DB_PATH="$WOLF_DB_PATH" pnpm --filter @wolf/api dev \
  > /tmp/wolf-ecosystem-logs/api.log 2>&1 &
pids+=($!)

echo "Starting Portal :$PORT_PORTAL"
PORT="$PORT_PORTAL" WOLF_API_ORIGIN="$WOLF_API_ORIGIN" \
  NEXT_PUBLIC_FINANCE_URL="$NEXT_PUBLIC_FINANCE_URL" \
  NEXT_PUBLIC_HR_URL="$NEXT_PUBLIC_HR_URL" \
  pnpm --filter @wolf/portal dev \
  > /tmp/wolf-ecosystem-logs/portal.log 2>&1 &
pids+=($!)

echo "Starting Finance :$PORT_FINANCE"
PORT="$PORT_FINANCE" WOLF_API_ORIGIN="$WOLF_API_ORIGIN" WOLF_JWKS_URL="$WOLF_JWKS_URL" \
  pnpm --filter @wolf/finance dev \
  > /tmp/wolf-ecosystem-logs/finance.log 2>&1 &
pids+=($!)

echo "Starting HR :$PORT_HR"
PORT="$PORT_HR" WOLF_API_ORIGIN="$WOLF_API_ORIGIN" WOLF_JWKS_URL="$WOLF_JWKS_URL" \
  pnpm --filter @wolf/hr dev \
  > /tmp/wolf-ecosystem-logs/hr.log 2>&1 &
pids+=($!)

echo ""
echo "Wolf ecosystem up (Ctrl+C to stop)"
echo "  API     $WOLF_API_ORIGIN"
echo "  Portal  http://127.0.0.1:$PORT_PORTAL"
echo "  Finance http://127.0.0.1:$PORT_FINANCE"
echo "  HR      http://127.0.0.1:$PORT_HR"
echo "  Seed login: owner@wolf.example / Wolf-Fake-Pass-1!"
echo "  Logs: /tmp/wolf-ecosystem-logs/"
wait
