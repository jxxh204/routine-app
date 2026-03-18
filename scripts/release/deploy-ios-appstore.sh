#!/usr/bin/env bash
set -euo pipefail

# One-command iOS App Store Connect upload (local Xcode path)
#
# Usage:
#   ./scripts/release/deploy-ios-appstore.sh
#   ./scripts/release/deploy-ios-appstore.sh --skip-preflight
#   ./scripts/release/deploy-ios-appstore.sh --team-id L67FAG9382 --bundle-id com.jxxh204.routinechallenge

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
IOS_DIR="$MOBILE_DIR/ios"
BUILD_DIR="$IOS_DIR/build"
ARCHIVE_PATH="$BUILD_DIR/RoutineChallenge.xcarchive"
EXPORT_APPSTORE_DIR="$BUILD_DIR/export-appstore"
EXPORT_UPLOAD_DIR="$BUILD_DIR/export-upload"
WORKSPACE_PATH="$IOS_DIR/RoutineChallenge.xcworkspace"
SCHEME="RoutineChallenge"
CONFIGURATION="Release"
TEAM_ID="L67FAG9382"
BUNDLE_ID="com.jxxh204.routinechallenge"
SKIP_PREFLIGHT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team-id)
      TEAM_ID="${2:-}"
      shift 2
      ;;
    --bundle-id)
      BUNDLE_ID="${2:-}"
      shift 2
      ;;
    --skip-preflight)
      SKIP_PREFLIGHT=true
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      exit 1
      ;;
  esac
done

[[ -d "$MOBILE_DIR" ]] || { echo "❌ apps/mobile not found"; exit 1; }
[[ -d "$IOS_DIR" ]] || { echo "❌ apps/mobile/ios not found. Run expo prebuild first."; exit 1; }
[[ -f "$WORKSPACE_PATH" ]] || { echo "❌ Workspace not found: $WORKSPACE_PATH"; exit 1; }

if [[ ! -f "$MOBILE_DIR/.env" ]]; then
  echo "❌ apps/mobile/.env not found"
  echo "   create: cp apps/mobile/.env.example apps/mobile/.env"
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "❌ xcodebuild not found"
  exit 1
fi

if ! grep -q '^EXPO_PUBLIC_WEB_APP_URL=' "$MOBILE_DIR/.env"; then
  echo "❌ EXPO_PUBLIC_WEB_APP_URL is missing in apps/mobile/.env"
  exit 1
fi

if [[ "$SKIP_PREFLIGHT" != "true" ]]; then
  echo "[1/8] Running preflight"
  "$ROOT_DIR/scripts/release/ios-local-preflight.sh"
else
  echo "[1/8] Preflight skipped"
fi

echo "[2/8] Ensuring mobile deps"
cd "$MOBILE_DIR"
npm ci

echo "[3/8] Ensuring iOS native project metadata"
npx expo prebuild --platform ios --no-install

mkdir -p "$BUILD_DIR"

echo "[4/8] Creating ExportOptions plist files"
cat > "$BUILD_DIR/ExportOptions-appstore.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>destination</key>
  <string>export</string>
</dict>
</plist>
EOF

cat > "$BUILD_DIR/ExportOptions-upload.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>destination</key>
  <string>upload</string>
</dict>
</plist>
EOF

rm -rf "$ARCHIVE_PATH" "$EXPORT_APPSTORE_DIR" "$EXPORT_UPLOAD_DIR"

echo "[5/8] Archive"
cd "$ROOT_DIR"
xcodebuild \
  -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive

echo "[6/8] Export (App Store package)"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_APPSTORE_DIR" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions-appstore.plist" \
  -allowProvisioningUpdates

echo "[7/8] Upload to App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_UPLOAD_DIR" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions-upload.plist" \
  -allowProvisioningUpdates

echo "[8/8] Done"
echo "✅ Upload flow finished."
echo "- Archive: $ARCHIVE_PATH"
echo "- Export:  $EXPORT_APPSTORE_DIR"
echo "- Upload:  $EXPORT_UPLOAD_DIR"
echo
echo "다음 단계: App Store Connect에서 TestFlight processing 완료 후 내부 테스터 배포"
