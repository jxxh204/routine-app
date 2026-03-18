#!/usr/bin/env bash
set -euo pipefail

# One-command web production deploy with provider switching
#
# Usage:
#   ./scripts/release/deploy-web.sh --provider cloudflare
#   ./scripts/release/deploy-web.sh --provider vercel
#   ./scripts/release/deploy-web.sh --provider cloudflare --no-watch
#   ./scripts/release/deploy-web.sh --provider vercel --no-auto-ios-on-switch
#
# Behavior:
# - requires explicit provider selection (cloudflare|vercel)
# - creates/pushes release tag (vYYYY.MM.DD-N)
# - triggers selected provider workflow
# - updates apps/mobile/.env URL/allowlist to selected provider
# - if provider changed, auto-runs iOS App Store deploy (unless disabled)

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
REPO="jxxh204/routine-app"
WATCH=true
TAG=""
PROVIDER=""
AUTO_IOS_ON_SWITCH=true

# Cloudflare default (already in use)
CF_WEB_URL_DEFAULT="https://routine-pages.pages.dev/today"
CF_WEB_HOST_DEFAULT="routine-pages.pages.dev"

# Vercel defaults come from environment to avoid hardcoding unknown project domain
VERCEL_WEB_URL_DEFAULT="${VERCEL_WEB_APP_URL:-}"
VERCEL_WEB_HOST_DEFAULT="${VERCEL_WEB_APP_HOST:-}"

STATE_DIR="$ROOT_DIR/.release"
STATE_FILE="$STATE_DIR/active-web-provider"
MOBILE_ENV_FILE="$ROOT_DIR/apps/mobile/.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      PROVIDER="${2:-}"
      shift 2
      ;;
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --no-watch)
      WATCH=false
      shift
      ;;
    --auto-ios-on-switch)
      AUTO_IOS_ON_SWITCH=true
      shift
      ;;
    --no-auto-ios-on-switch)
      AUTO_IOS_ON_SWITCH=false
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$PROVIDER" ]]; then
  echo "❌ --provider is required (cloudflare|vercel)"
  echo "   example: ./scripts/release/deploy-web.sh --provider cloudflare"
  exit 1
fi

case "$PROVIDER" in
  cloudflare)
    WORKFLOW_FILE="web-cloudflare-pages.yml"
    TARGET_WEB_URL="$CF_WEB_URL_DEFAULT"
    TARGET_WEB_HOST="$CF_WEB_HOST_DEFAULT"
    ;;
  vercel)
    WORKFLOW_FILE="web-vercel.yml"
    TARGET_WEB_URL="$VERCEL_WEB_URL_DEFAULT"
    TARGET_WEB_HOST="$VERCEL_WEB_HOST_DEFAULT"
    if [[ -z "$TARGET_WEB_URL" || -z "$TARGET_WEB_HOST" ]]; then
      echo "❌ Vercel provider selected but VERCEL_WEB_APP_URL / VERCEL_WEB_APP_HOST not set"
      echo "   set env before deploy, e.g."
      echo "   export VERCEL_WEB_APP_URL='https://your-vercel-domain/today'"
      echo "   export VERCEL_WEB_APP_HOST='your-vercel-domain'"
      exit 1
    fi
    ;;
  *)
    echo "❌ Unknown provider: $PROVIDER (expected: cloudflare|vercel)"
    exit 1
    ;;
esac

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
  echo "[1/7] Creating tag: $TAG"
  git tag -a "$TAG" -m "release: web production deploy ($PROVIDER)"
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  echo "⚠️ Current branch is '$current_branch' (not main)."
fi

echo "[2/7] Pushing tag"
git push origin "$TAG"

echo "[3/7] Waiting for workflow run to appear ($WORKFLOW_FILE)"
sleep 5

run_id="$(gh run list --repo "$REPO" --workflow "$WORKFLOW_FILE" --json databaseId,headBranch,event,headSha,createdAt --jq '.[0].databaseId' 2>/dev/null || true)"

if [[ -z "$run_id" || "$run_id" == "null" ]]; then
  echo "⚠️ Could not detect run immediately. Check manually:"
  echo "   gh run list --repo $REPO --workflow $WORKFLOW_FILE"
  exit 0
fi

echo "[4/7] Workflow run detected: $run_id"
if [[ "$WATCH" == "true" ]]; then
  gh run watch "$run_id" --repo "$REPO"
  echo "✅ Web deployment flow finished."
else
  echo "ℹ️ Skipped watch. View run: gh run view $run_id --repo $REPO"
fi

# Keep mobile app WebView target in sync with selected web provider
mkdir -p "$STATE_DIR"

if [[ ! -f "$MOBILE_ENV_FILE" ]]; then
  echo "❌ apps/mobile/.env not found"
  echo "   create: cp apps/mobile/.env.example apps/mobile/.env"
  exit 1
fi

update_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$MOBILE_ENV_FILE"; then
    perl -0pi -e "s#^${key}=.*#${key}=${value}#m" "$MOBILE_ENV_FILE"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$MOBILE_ENV_FILE"
  fi
}

echo "[5/7] Updating mobile env for provider=$PROVIDER"
update_env "MOBILE_WEB_APP_URL" "$TARGET_WEB_URL"
update_env "MOBILE_WEB_APP_ALLOWED_HOSTS" "$TARGET_WEB_HOST"
# legacy fallback keys (for gradual migration compatibility)
update_env "EXPO_PUBLIC_WEB_APP_URL" "$TARGET_WEB_URL"
update_env "EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS" "$TARGET_WEB_HOST"

previous_provider=""
if [[ -f "$STATE_FILE" ]]; then
  previous_provider="$(cat "$STATE_FILE" | tr -d '[:space:]')"
fi

echo "$PROVIDER" > "$STATE_FILE"

switched=false
if [[ -n "$previous_provider" && "$previous_provider" != "$PROVIDER" ]]; then
  switched=true
fi

echo "[6/7] Provider state: previous=${previous_provider:-none}, current=$PROVIDER, switched=$switched"

if [[ "$switched" == "true" && "$AUTO_IOS_ON_SWITCH" == "true" ]]; then
  echo "[7/7] Provider changed -> auto iOS redeploy"
  "$ROOT_DIR/scripts/release/deploy-ios-appstore.sh"
else
  echo "[7/7] iOS auto redeploy skipped"
  if [[ "$switched" == "true" ]]; then
    echo "   (reason: --no-auto-ios-on-switch)"
  else
    echo "   (reason: provider unchanged)"
  fi
fi
