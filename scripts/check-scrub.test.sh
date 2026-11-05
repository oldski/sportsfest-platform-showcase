#!/usr/bin/env bash
# Test for check-scrub.sh: a clean file passes, a dirty file fails with one line per hit.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail=0

mkdir -p "$TMP/clean" "$TMP/dirty"
cat > "$TMP/clean/clean.ts" <<'TS'
const email = 'jordan@example.com'; // sportsfest.com, join.sportsfest.com, laybl-labs.com
import { Button } from '@workspace/ui/components/button';
TS

cat > "$TMP/dirty/dirty.ts" <<'TS'
sk_live_abc
whsec_abc
price_1ABC
prod_ABC
postgresql://u:p@h/db
plpmhzbnwlbrvuebmrvw
phbfwxefzyuzpypbjbfd
supabase.co
someone@gmail.com
oldski/sportsfestDashboard
Michael Scott
scripts/reconciliation
TS

out=$(cd "$TMP" && bash "$HERE/check-scrub.sh" clean 2>&1); rc=$?
if [ $rc -ne 0 ] || [ "$out" != "scrub: clean" ]; then
  echo "FAIL: clean dir should exit 0 with 'scrub: clean' (rc=$rc, out=$out)"; fail=1
else
  echo "ok: clean dir passes"
fi

out=$(cd "$TMP" && bash "$HERE/check-scrub.sh" dirty 2>&1); rc=$?
hits=$(printf '%s\n' "$out" | grep -c 'dirty.ts:')
if [ $rc -ne 1 ] || [ "$hits" -ne 12 ]; then
  echo "FAIL: dirty dir should exit 1 with 12 hits (rc=$rc, hits=$hits)"; printf '%s\n' "$out"; fail=1
else
  echo "ok: dirty dir fails with 12 hits"
fi

exit $fail
