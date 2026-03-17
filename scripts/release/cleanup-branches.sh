#!/usr/bin/env bash
set -euo pipefail

# Dry-run helper for stale branch cleanup.
#
# Rules:
# - merged into origin/main
# - excluding protected prefixes and current branch
# - show candidates older than N days (default: 7)

DAYS="${1:-7}"
PROTECTED_REGEX='^(main|master|develop|feat/webview-unification)$'

current_branch=$(git rev-parse --abbrev-ref HEAD)
cutoff_epoch=$(date -v-"${DAYS}"d +%s 2>/dev/null || date -d "-${DAYS} days" +%s)

echo "🔎 stale branch candidates (> ${DAYS} days, merged to origin/main)"

git fetch origin --prune >/dev/null 2>&1 || true

while IFS= read -r branch; do
  short="${branch#origin/}"

  if [[ "$short" == "$current_branch" ]]; then
    continue
  fi

  if [[ "$short" =~ $PROTECTED_REGEX ]]; then
    continue
  fi

  last_commit_date=$(git log -1 --format=%ct "$branch" 2>/dev/null || echo 0)
  if [[ "$last_commit_date" -gt "$cutoff_epoch" ]]; then
    continue
  fi

  echo "  - $short"
done < <(git branch -r --merged origin/main | sed 's/^ *//' | grep '^origin/' | grep -v 'origin/HEAD')

echo
echo "ℹ️ delete example: git push origin --delete <branch>"
