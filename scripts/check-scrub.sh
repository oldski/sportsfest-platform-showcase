#!/usr/bin/env bash
# Scrub checker: fails if anything that must never appear in the showcase is found.
# Usage: scripts/check-scrub.sh [DIR_OR_FILE ...]   (default: code docs README.md)
# Exit 0 and print "scrub: clean" when nothing matches; exit 1 and print file:line: match otherwise.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(code docs README.md)
existing=()
for t in "${targets[@]}"; do [ -e "$t" ] && existing+=("$t"); done
[ ${#existing[@]} -eq 0 ] && { echo "scrub: clean"; exit 0; }

hits=0
report() { # $1 = grep output (file:line:text)
  [ -z "$1" ] && return
  printf '%s\n' "$1" | sed -E 's/^([^:]+:[0-9]+):(.*)$/\1: \2/'
  hits=$((hits + $(printf '%s\n' "$1" | grep -c .)))
}

TOKENS='sk_(live|test)_|pk_(live|test)_|whsec_|\bprice_[A-Za-z0-9]|\bprod_[A-Za-z0-9]|postgres(ql)?://|supabase\.co|plpmhzbnwlbrvuebmrvw|phbfwxefzyuzpypbjbfd|sportsfestDashboard|scripts/reconciliation'
report "$(grep -rnoE --exclude-dir=scripts --exclude-dir=.git "$TOKENS" "${existing[@]}" 2>/dev/null)"

# Email addresses, minus allowed domains and npm scopes.
EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
ALLOW='@example\.com|@sportsfest\.com|@laybl-labs\.com|@workspace/|@radix-ui/|@tanstack/|@react-email/|@stripe/|@auth/|@types/|@hookform/|@sentry/|@ebay/|@react-pdf/'
report "$(grep -rnoE --exclude-dir=scripts --exclude-dir=.git "$EMAIL" "${existing[@]}" 2>/dev/null | grep -vE "$ALLOW")"

# Real names, fixed strings, case-insensitive.
if [ -s "$HERE/forbidden-names.txt" ]; then
  report "$(grep -rnoiF --exclude-dir=scripts --exclude-dir=.git -f "$HERE/forbidden-names.txt" "${existing[@]}" 2>/dev/null)"
fi

if [ "$hits" -gt 0 ]; then exit 1; fi
echo "scrub: clean"
