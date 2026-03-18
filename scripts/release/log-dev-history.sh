#!/usr/bin/env bash
set -euo pipefail

# Append one structured entry to docs/dev-history.md
# Usage:
#   ./scripts/release/log-dev-history.sh \
#     --title "iOS 배포 스크립트 개선" \
#     --repro "build number 수동 관리" \
#     --cause "로컬 xcodebuild 경로 자동증가 미적용" \
#     --fix "build number 자동 +1 적용" \
#     --scope "release"

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT_DIR/docs/dev-history.md"

TITLE=""
REPRO=""
CAUSE=""
FIX=""
SCOPE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE="${2:-}"; shift 2 ;;
    --repro) REPRO="${2:-}"; shift 2 ;;
    --cause) CAUSE="${2:-}"; shift 2 ;;
    --fix) FIX="${2:-}"; shift 2 ;;
    --scope) SCOPE="${2:-}"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

[[ -n "$TITLE" && -n "$REPRO" && -n "$CAUSE" && -n "$FIX" ]] || {
  echo "❌ required: --title --repro --cause --fix"
  exit 1
}

cd "$ROOT_DIR"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo 'uncommitted')"
DATE="$(TZ=Asia/Seoul date +%Y-%m-%d)"

if [[ ! -f "$OUT" ]]; then
  cat > "$OUT" <<EOF
# Dev History (개발 이력)

EOF
fi

{
  echo
  echo "## ${DATE}"
  echo
  echo "### [${COMMIT}] ${TITLE}"
  echo "- 재현: ${REPRO}"
  echo "- 원인: ${CAUSE}"
  echo "- 해결: ${FIX}"
  [[ -n "$SCOPE" ]] && echo "- 영향 범위: ${SCOPE}"
} >> "$OUT"

echo "✅ appended: $OUT"
