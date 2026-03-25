#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local status="$2"
  local expected="$3"
  if [[ "$status" == "$expected" ]]; then
    echo "  PASS  $name"
    ((PASS++))
  else
    echo "  FAIL  $name (got status $status, expected $expected)"
    ((FAIL++))
  fi
}

echo "Smoke test against $API_URL"
echo "----------------------------------------"

# ── 1. Health ────────────────────────────────────────────────────────────────
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
check "GET /health" "$STATUS" "200"

# ── 2. Register ──────────────────────────────────────────────────────────────
TIMESTAMP=$(date +%s)
REGISTER_BODY=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"smoke-${TIMESTAMP}@test.dev\",\"username\":\"smokeuser${TIMESTAMP}\",\"password\":\"password123\"}")
HAS_TOKEN=$(echo "$REGISTER_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'token' in d else 'no')" 2>/dev/null || echo "no")
USER_ID=$(echo "$REGISTER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))" 2>/dev/null || echo "")
check "POST /api/auth/register" "$HAS_TOKEN" "yes"

# ── 3. Create World ──────────────────────────────────────────────────────────
WORLD_BODY=$(curl -s -X POST "$API_URL/api/worlds" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Smoke Test World ${TIMESTAMP}\",
    \"description\": \"Created by smoke test\",
    \"visibility\": \"PUBLIC\",
    \"foundationalLaws\": [\"Law of Tests\"],
    \"culturalTypologies\": [\"Testers\"],
    \"creatorId\": \"${USER_ID}\"
  }")
WORLD_ID=$(echo "$WORLD_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('world',{}).get('id',''))" 2>/dev/null || echo "")
HAS_WORLD=$(echo "$WORLD_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'world' in d else 'no')" 2>/dev/null || echo "no")
check "POST /api/worlds" "$HAS_WORLD" "yes"

# ── 4. Fetch Veda ────────────────────────────────────────────────────────────
if [[ -n "$WORLD_ID" ]]; then
  VEDA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/worlds/$WORLD_ID/veda")
  check "GET /api/worlds/:id/veda" "$VEDA_STATUS" "200"
else
  echo "  SKIP  GET /api/worlds/:id/veda (world creation failed, no ID)"
  ((FAIL++))
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo "----------------------------------------"
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
