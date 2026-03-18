#!/usr/bin/env bash
set -euo pipefail

# One-command web production deploy
# - creates/pushes release tag (vYYYY.MM.DD-N)
# - triggers existing tag-based GitHub Actions deployment
# - optionally watches workflow run status
#
# Usage:
#   ./scripts/release/deploy-web.sh
#   ./scripts/release/deploy-web.sh --tag v2026.03.18-1
#   ./scripts/release/deploy-web.sh --no-watch

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
REPO="jxxh204/routine-app"
WATCH=true
TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --no-watch)
      WATCH=false
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

"$ROOT_DIR/scripts/release/preflight-common.sh" --target web

if [[ -z "${TAG}" ]]; then
  date_prefix="$(date +%Y.%m.%d)"
  last_for_day="$(git tag --list "v${date_prefix}-*" | sed -E 's/^v[0-9]{4}\.[0-9]{2}\.[0-9]{2}-//' | sort -n | tail -1)"
  if [[ -z "${last_for_day}" ]]; then
    next_n=1
  else
    next_n=$((last_for_day + 1))
  fi
  TAG="v${date_prefix}-${next_n}"
fi

"$ROOT_DIR/scripts/release/check-tag-before-deploy.sh" "$TAG" >/dev/null 2>&1 || true

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "ℹ️ Tag already exists locally: $TAG"
else
  echo "[1/4] Creating tag: $TAG"
  git tag -a "$TAG" -m "release: web production deploy"
fi

# push main first for safety
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  echo "⚠️ Current branch is '$current_branch' (not main)."
fi

echo "[2/4] Pushing tag"
git push origin "$TAG"

echo "[3/4] Waiting for workflow run to appear"
sleep 5

run_id="$(gh run list --repo "$REPO" --workflow web-cloudflare-pages.yml --json databaseId,headBranch,event,headSha,createdAt --jq '.[0].databaseId' 2>/dev/null || true)"

if [[ -z "$run_id" || "$run_id" == "null" ]]; then
  echo "⚠️ Could not detect run immediately. Check manually:"
  echo "   gh run list --repo $REPO --workflow web-cloudflare-pages.yml"
  exit 0
fi

echo "[4/4] Workflow run detected: $run_id"
if [[ "$WATCH" == "true" ]]; then
  gh run watch "$run_id" --repo "$REPO"
  echo "✅ Web deployment flow finished."
else
  echo "ℹ️ Skipped watch. View run: gh run view $run_id --repo $REPO"
fi
