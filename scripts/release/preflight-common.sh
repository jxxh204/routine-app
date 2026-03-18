#!/usr/bin/env bash
set -euo pipefail

# Common release preflight
# Usage:
#   ./scripts/release/preflight-common.sh --target web
#   ./scripts/release/preflight-common.sh --target ios

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "❌ --target is required (web|ios)"
  exit 1
fi

cd "$ROOT_DIR"

echo "[common] Checking git workspace"
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "main" ]]; then
  echo "⚠️ Current branch: $current_branch (recommended: main)"
fi

dirty="$(git status --porcelain)"
if [[ -n "$dirty" ]]; then
  echo "⚠️ Working tree has uncommitted changes"
fi

echo "[common] Checking required tools"
command -v git >/dev/null 2>&1 || { echo "❌ git not found"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ node not found"; exit 1; }

case "$TARGET" in
  web)
    command -v gh >/dev/null 2>&1 || { echo "❌ gh CLI not found"; exit 1; }
    gh auth status >/dev/null 2>&1 || { echo "❌ gh auth is not ready. Run: gh auth login"; exit 1; }
    ;;
  ios)
    command -v xcodebuild >/dev/null 2>&1 || { echo "❌ xcodebuild not found"; exit 1; }
    ;;
  *)
    echo "❌ Unknown target: $TARGET (expected web|ios)"
    exit 1
    ;;
esac

echo "✅ common preflight passed ($TARGET)"