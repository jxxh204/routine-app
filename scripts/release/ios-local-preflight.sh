#!/usr/bin/env bash
set -euo pipefail

# Local iOS release preflight for apps/mobile
# - verifies required tooling
# - validates project deps
# - runs type/test checks before Xcode Archive

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"

echo "[1/7] Checking workspace"
[[ -d "$MOBILE_DIR" ]] || { echo "❌ apps/mobile not found"; exit 1; }

cd "$MOBILE_DIR"

echo "[2/7] Checking Node/npm"
node -v
npm -v

echo "[3/7] Checking Expo CLI"
npx expo --version >/dev/null
npx expo --version

echo "[4/7] Checking Xcode tools"
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "❌ xcodebuild not found. Install Xcode and Command Line Tools."
  exit 1
fi
xcodebuild -version

echo "[5/7] Install dependencies"
npm ci

echo "[6/7] Verify types/tests"
npx tsc --noEmit
npm run test

echo "[7/7] Generate iOS project metadata check"
npx expo prebuild --platform ios --no-install

echo
cat <<'EOF'
✅ iOS local preflight passed.

Next (manual):
1) open apps/mobile/ios/*.xcworkspace in Xcode
2) Product > Archive
3) Organizer > Distribute App > App Store Connect > Upload
EOF
