# routine-app

루틴앱 초기 세팅 (React Native + WebView)

## 구조

- `apps/mobile`: Expo 기반 모바일 앱 (WebView 셸)
- `apps/web`: Next.js 웹앱 (today 화면 뼈대 + Supabase 연결 준비)

## 빠른 시작

```bash
# web
cd apps/web
npm install
npm run dev

# mobile
cd ../mobile
npm install
npm run ios     # 또는 npm run android
```

## 현재 상태 (MVP 준비)

- [x] Expo(TypeScript) 앱 생성
- [x] `react-native-webview` 설치
- [x] WebView 기본 화면 구성 (`App.tsx`)
- [x] Next.js 웹앱 생성 (`apps/web`)
- [x] `/today` 화면 뼈대 생성
- [x] 모바일 WebView 로컬 URL 연결 (`http://localhost:3000/today`)
- [ ] 로그인/루틴 API 연결

## 개발 이력/롤백 문서

- 개발 이력: `docs/dev-history.md`
- 롤백 가이드: `docs/rollback-guide.md`
- 이력 append 스크립트: `scripts/release/log-dev-history.sh`

원칙:
- 큰 변경은 `재현 → 원인 → 해결` 3줄로 기록
- 커밋 해시를 반드시 남겨서 되돌리기 쉽게 유지

예시:
```bash
./scripts/release/log-dev-history.sh \
  --title "Web 배포 경로 수정" \
  --repro "Cloudflare 배포 결과가 비어있음" \
  --cause "pages deploy 경로 오지정" \
  --fix "apps/web/.vercel/output/static 경로로 수정" \
  --scope "web,ci"
```

## 배포 커맨드 (원커맨드)

### 웹 배포 (Provider 스위칭: Cloudflare/Vercel)

```bash
# Cloudflare로 배포
./scripts/release/deploy-web.sh --provider cloudflare

# Vercel로 배포
./scripts/release/deploy-web.sh --provider vercel
```

- `--provider`는 필수(배포 전에 대상 선택 강제)
- 릴리즈 태그(`vYYYY.MM.DD-N`) 자동 생성/푸시
- 선택한 워크플로우 자동 트리거:
  - Cloudflare: `web-cloudflare-pages`
  - Vercel: `web-vercel`
- 스위칭 시(`cloudflare ↔ vercel`) 모바일 `.env` WebView 대상 자동 변경
- 스위칭 시 기본값으로 iOS 앱도 자동 재배포(필요 시 `--no-auto-ios-on-switch`)

### 앱 배포 (iOS App Store Connect 업로드)

```bash
./scripts/release/deploy-ios-appstore.sh
```

- preflight → archive → export → upload를 한 번에 실행
- 실행 시 `app.json`의 `ios.buildNumber`를 자동 +1
- 버전 고정 배포 예시:

```bash
./scripts/release/deploy-ios-appstore.sh --version 1.0.1
```

- 빌드번호 직접 지정 예시:

```bash
./scripts/release/deploy-ios-appstore.sh --version 1.0.1 --build-number 3
```

- 도중 keychain 접근 허용 팝업이 뜨면 "항상 허용" 또는 "허용" 필요

## 모바일 env 설정

`apps/mobile/.env` 파일이 필요합니다(로컬 실행/빌드 공통):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

권장 값(신규):

- `MOBILE_WEB_APP_URL` (HTTPS, 예: `https://<your-pages-domain>/today`)
- `MOBILE_WEB_APP_ALLOWED_HOSTS` (쉼표 구분 allowlist)

레거시 호환 값(기존 Expo 키):

- `EXPO_PUBLIC_WEB_APP_URL`
- `EXPO_PUBLIC_WEB_APP_ALLOWED_HOSTS`

## 릴리즈 운영 기준

- 공통 릴리즈 계약: `docs/release-contract.md`
- 공통 사전검증: `scripts/release/preflight-common.sh --target web|ios`
- Vercel 배포 준비(최초 1회): GitHub Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- 로컬에서 Vercel 타겟 지정(필수):
  - `export VERCEL_WEB_APP_URL='https://<your-vercel-domain>/today'`
  - `export VERCEL_WEB_APP_HOST='<your-vercel-domain>'`
