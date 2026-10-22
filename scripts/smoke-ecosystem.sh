#!/usr/bin/env bash
# Smoke: login → /v1/me → Finance health → HR employees → create → outbox → finance.employee_ref
set -euo pipefail

API="${WOLF_API_ORIGIN:-http://127.0.0.1:4000}"
FINANCE="${NEXT_PUBLIC_FINANCE_URL:-http://127.0.0.1:3000}"
HR="${NEXT_PUBLIC_HR_URL:-http://127.0.0.1:3200}"
EMAIL="${SMOKE_EMAIL:-owner@wolf.example}"
PASS="${SMOKE_PASSWORD:-Wolf-Fake-Pass-1!}"
PROOF_DIR="${SMOKE_PROOF_DIR:-/cursor/stores/self/media/wolf-ecosystem}"
mkdir -p "$PROOF_DIR"

cookie_jar="$(mktemp)"
trap 'rm -f "$cookie_jar"' EXIT

echo "== health =="
curl -fsS "$API/health" | tee "$PROOF_DIR/api-health.json"
curl -fsS "$FINANCE/api/health" | tee "$PROOF_DIR/finance-health.json"
curl -fsS "$HR/api/health" | tee "$PROOF_DIR/hr-health.json"

echo "== login =="
curl -fsS -c "$cookie_jar" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  "$API/v1/auth/login" | tee "$PROOF_DIR/login.json" >/dev/null

echo "== /v1/me =="
curl -fsS -b "$cookie_jar" "$API/v1/me" | tee "$PROOF_DIR/me.json" >/dev/null
COMPANY_ID="$(python3 -c '
import json
data=json.load(open("'"$PROOF_DIR"'/me.json"))
companies=data.get("companies") or []
amg=next((c for c in companies if c.get("code")=="AMG"), None)
assert amg, "AMG missing from /v1/me"
assert "hr" in amg["apps"] and "finance" in amg["apps"], amg
print(amg["id"])
')"
echo "companyId=$COMPANY_ID"

echo "== finance handoff =="
FIN_TOKEN="$(curl -fsS -b "$cookie_jar" -H 'content-type: application/json' \
  -d "{\"audience\":\"finance\",\"companyId\":\"$COMPANY_ID\"}" \
  "$API/v1/handoff/token" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
curl -fsS -H 'content-type: application/json' -d "{\"token\":\"$FIN_TOKEN\"}" \
  "$FINANCE/api/wolf/handoff" | tee "$PROOF_DIR/finance-handoff.json" >/dev/null

echo "== hr handoff =="
HR_TOKEN="$(curl -fsS -b "$cookie_jar" -H 'content-type: application/json' \
  -d "{\"audience\":\"hr\",\"companyId\":\"$COMPANY_ID\"}" \
  "$API/v1/handoff/token" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
curl -fsS -H 'content-type: application/json' -d "{\"token\":\"$HR_TOKEN\"}" \
  "$HR/api/wolf/handoff" | tee "$PROOF_DIR/hr-handoff.json" >/dev/null

echo "== hr employees list =="
curl -fsS -b "$cookie_jar" -H "x-wolf-company-id: $COMPANY_ID" \
  "$API/v1/hr/employees" | tee "$PROOF_DIR/hr-employees.json" >/dev/null

TS="$(date +%s)"
echo "== create employee =="
curl -fsS -b "$cookie_jar" -H 'content-type: application/json' \
  -H "x-wolf-company-id: $COMPANY_ID" \
  -d "{\"fullName\":\"Smoke Employee ${TS}\",\"joinDate\":\"2026-10-22\",\"jobLevel\":\"L3\",\"baseSalaryMinor\":500000000,\"workEmail\":\"smoke.${TS}@wolf.example\",\"costCentre\":\"SMOKE\"}" \
  "$API/v1/hr/employees" | tee "$PROOF_DIR/hr-create.json" >/dev/null
EMP_ID="$(python3 -c 'import json; print(json.load(open("'"$PROOF_DIR"'/hr-create.json"))["employee"]["employment_id"])')"
echo "employmentId=$EMP_ID"

echo "== relay outbox =="
curl -fsS -X POST "$API/v1/events/relay" | tee "$PROOF_DIR/relay.json" >/dev/null

echo "== finance.employee_ref =="
curl -fsS "$API/v1/finance/employee-refs" | tee "$PROOF_DIR/employee-refs.json" >/dev/null
python3 -c '
import json
refs=json.load(open("'"$PROOF_DIR"'/employee-refs.json"))["refs"]
emp="'"$EMP_ID"'"
hit=next((r for r in refs if r["employment_id"]==emp), None)
assert hit, f"missing ref for {emp}"
assert hit["status"]=="active"
print("OK finance.employee_ref", hit["display_name"])
'

echo "SMOKE_OK" | tee "$PROOF_DIR/SMOKE_OK.txt"
echo "All smoke checks passed."
